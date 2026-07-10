"""Chat blueprint — Phase 2 (write actions + HITL).

Phase 1's read-only router graph is extended into one that can *act* on the
user's behalf and hand off to a human:

    START → recall → router
          → {order|product|promotion|account|payment|returns|support|faq} → END

- **router**: a `gpt-4o-mini` structured-output call returns {intent, confidence}.
  Low confidence (or unknown intent) degrades to the FAQ/General agent.
- **workers**: read-only `create_react_agent` nodes (Phase 1) plus two new ones —
  Returns & Refunds and Support & Escalation. Write-capable agents (order,
  account, promotion, returns) receive **confirmation-gated local tools** rather
  than the raw MCP write tools (see `make_confirm_tool`).
- **HITL Kind A** (confirm/deny): every irreversible / financial action is wrapped
  in a local LangChain tool that calls `interrupt()`. The graph pauses, the SSE
  stream emits `event: interrupt`, and the real MCP write fires only after the
  user approves via `POST /chat/resume` (`Command(resume=...)`). State survives
  the two separate HTTP requests via an `AsyncPostgresSaver` checkpointer keyed on
  `thread_id = chats.id`.
- **HITL Kind B** (escalation): the Support agent can call `escalate_to_human`
  (no confirmation) which files a ticket, flips `chats.escalated`/`status`, and
  bridges a summary into `support_messages` so the existing admin support view
  picks it up. Once a chat is escalated the bot goes silent on that thread — the
  `/chat/stream` handler routes further messages straight into `support_messages`.

The Phase 0/1 SSE token contract (`event: session` → `data: {"token": ...}` →
`event: done`), the `MultiServerMCPClient` JWT forwarding, and the async→sync
bridge are all preserved. Only worker-node tokens are streamed.
"""
import os
import json
import asyncio
from typing import TypedDict, Annotated

from flask import Blueprint, request, Response, stream_with_context
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessageChunk
from langchain_core.tools import tool, StructuredTool
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.prebuilt import create_react_agent
from langgraph.types import interrupt, Command
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from auth_middleware import token_required
from database import get_connection

chat_bp = Blueprint("chat", __name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8900") + "/mcp"
DATABASE_URL = os.environ["DATABASE_URL"]

# Chat + router model (OpenAI). Override with the CHAT_MODEL env var.
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")

CONFIDENCE_THRESHOLD = 0.5
INTENTS = ["order", "product", "promotion", "account", "payment",
           "returns", "support", "faq"]

ROUTER_PROMPT = (
    "Classify the user's latest message into exactly one intent:\n"
    "- order: track/status of a specific order, or cancel/modify an order\n"
    "- product: availability, specs, comparison, product search\n"
    "- promotion: coupons / active discounts / whether a coupon is valid\n"
    "- account: the user's own profile, addresses, order history, password reset\n"
    "- payment: payment status, double/duplicate charge questions\n"
    "- returns: returning or exchanging an item, refund status\n"
    "- support: complaints, damaged/missing items, or asking to talk to a human\n"
    "- faq: greetings, small talk, policy questions, anything else\n"
    "Return the intent and your confidence (0..1)."
)

WORKER_PROMPTS = {
    "order": (
        "You are the Order agent for our e-commerce store (prices in PKR). "
        "Answer about the user's own orders using get_orders / get_order. You can "
        "also cancel a pending/paid order (cancel_order) or modify one "
        "(modify_order). IMPORTANT: do NOT ask the user to confirm in text — the "
        "system shows the user a confirmation dialog automatically whenever you "
        "call these tools, so as soon as you know the order id, CALL the tool "
        "directly. A shipped/delivered order cannot be cancelled or modified. "
        "Be concise and friendly."
    ),
    "product": (
        "You are the Product agent (prices in PKR). Answer availability, specs, "
        "and comparisons using the product tools (search_products, get_product). "
        "For availability use search_products and report stock; for specs use "
        "get_product; to compare, fetch each product and contrast them. Use "
        "search_knowledge_base only for policy details. Be concise and friendly."
    ),
    "promotion": (
        "You are the Promotion agent (prices in PKR). List currently active "
        "coupons via list_active_coupons. To check whether a specific coupon is "
        "valid (optionally for a cart total), call validate_coupon. Do NOT ask the "
        "user to confirm in text — the system shows a confirmation dialog "
        "automatically when you call validate_coupon, so call it directly once you "
        "have the code. Be concise and friendly."
    ),
    "account": (
        "You are the Account agent (prices in PKR). Answer questions about the "
        "user's profile (get_profile), order history (get_orders), and saved "
        "shipping addresses (list_addresses). You can update the profile "
        "(update_profile), add an address (add_address), or start a password reset "
        "(request_password_reset). IMPORTANT: do NOT ask the user to confirm in "
        "text — the system shows a confirmation dialog automatically when you call "
        "these tools, so as soon as you have the needed details, CALL the tool "
        "directly (for a password reset, call request_password_reset immediately). "
        "Be concise and friendly."
    ),
    "payment": (
        "You are the Payment agent (prices in PKR). Report payment status using "
        "the payment tools. To check for a double charge on an order, call "
        "get_order_payments and inspect the rows: if two payments with status "
        "'success' share the same order_id and amount, flag a likely double "
        "charge and suggest the user contact support to resolve it. Otherwise "
        "reassure them there is only one charge. Be concise and friendly."
    ),
    "returns": (
        "You are the Returns & Refunds agent (prices in PKR). Help the user return "
        "or exchange items and check refund status. Use get_returns / "
        "get_return_status to report status (read-only). To file a return "
        "(type='return') or an exchange (type='exchange') for one of the user's "
        "orders, call create_return. Do NOT ask the user to confirm in text — the "
        "system shows a confirmation dialog automatically when you call "
        "create_return, so as soon as you know the order id and whether it is a "
        "return or exchange, CALL the tool directly. Be concise and empathetic."
    ),
    "support": (
        "You are the Support & Escalation agent (prices in PKR). Handle complaints, "
        "damaged/missing-item reports, and requests to speak to a human. Gather the "
        "essentials (what is wrong, which order, and note that a photo can be "
        "attached for damaged items), then call create_ticket to open a ticket. If "
        "the user explicitly asks for a human, or the issue is a serious complaint "
        "or abusive/sensitive, call escalate_to_human with a short summary and a "
        "reason — this connects them to a human agent who will continue in this "
        "chat. Be empathetic and concise."
    ),
    "faq": (
        "You are the customer-support assistant for our e-commerce store (all "
        "prices in PKR). Greet warmly and handle greetings and small talk "
        "naturally. For any policy / shipping / returns / refunds / warranty "
        "question, call search_knowledge_base and answer ONLY from what it "
        "returns; if it has nothing relevant, say you're not sure and offer to "
        "connect the customer with a human agent. Never invent policies, prices, "
        "or delivery times. Keep answers concise and friendly."
    ),
}

# Read tools each agent may use raw (must match mcp_server/tools/* exactly).
AGENT_READ = {
    "order":     ("get_orders", "get_order"),
    "product":   ("search_products", "get_product", "search_knowledge_base"),
    "promotion": ("list_active_coupons",),
    "account":   ("get_orders", "get_profile", "list_addresses"),
    "payment":   ("get_payments", "get_payment_status", "get_order_payments"),
    "returns":   ("get_returns", "get_return_status"),
    "support":   ("get_tickets",),
    "faq":       ("search_knowledge_base", "get_orders"),
}

# Write tools each agent may use, wrapped in a confirmation gate (HITL Kind A).
AGENT_GATED = {
    "order":     ("cancel_order", "modify_order"),
    "promotion": ("validate_coupon",),
    "account":   ("update_profile", "add_address", "request_password_reset"),
    "returns":   ("create_return",),
}

# Human-readable one-liners shown on the confirm card, per gated tool.
GATE_SUMMARIES = {
    "cancel_order":  lambda a: f"Cancel order #{a.get('order_id')}?",
    "modify_order":  lambda a: f"Modify order #{a.get('order_id')} with {a.get('changes')}?",
    "create_return": lambda a: (
        f"File a {a.get('type', 'return')} for order #{a.get('order_id')}"
        + (f" (reason: {a.get('reason')})" if a.get("reason") else "") + "?"
    ),
    "validate_coupon": lambda a: f"Apply/validate coupon {a.get('code')}?",
    "add_address":   lambda a: f"Add this address: {a.get('line1')}, {a.get('city')}?",
    "update_profile": lambda a: f"Update your profile: {a.get('changes')}?",
    "request_password_reset": lambda a: "Start a password reset for your account?",
}

WORKER_NODES = set(WORKER_PROMPTS)  # nodes whose tokens we stream to the user


class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: int
    jwt: str                  # threaded to every MCP tool call
    chat_id: int              # the checkpointer thread id / escalation target
    active_agent: str         # which worker handled this turn (persisted)
    router_confidence: float  # low → FAQ/General fallback
    hitl_pending: bool        # a gated tool is awaiting confirmation
    escalated: bool           # mirrors chats.escalated for this session


class Route(BaseModel):
    intent: str = Field(description=f"one of {INTENTS}")
    confidence: float = Field(description="0..1 certainty")


# --------------------------------------------------------------------------- #
# Chat-session DB helpers (direct DB, same as Phase 0/1 _persist)
# --------------------------------------------------------------------------- #

def _get_or_create_chat(user_id: int, session_id) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        if session_id:
            cur.execute(
                "SELECT id FROM chats WHERE id = %s AND user_id = %s",
                (session_id, user_id),
            )
            if cur.fetchone():
                return int(session_id)
        cur.execute(
            "INSERT INTO chats (user_id) VALUES (%s) RETURNING id", (user_id,)
        )
        cid = cur.fetchone()["id"]
        conn.commit()
        return int(cid)
    finally:
        cur.close()
        conn.close()


def _persist(chat_id: int, role: str, content: str, agent: str | None = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO chat_messages (chat_id, role, content, agent) VALUES (%s, %s, %s, %s)",
            (chat_id, role, content, agent),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _is_escalated(chat_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT escalated FROM chats WHERE id = %s", (chat_id,))
        row = cur.fetchone()
        return bool(row and row.get("escalated"))
    finally:
        cur.close()
        conn.close()


def _bridge_to_support(user_id: int, message: str):
    """Drop a user's message into the existing admin support inbox."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO support_messages (user_id, sender_type, message) VALUES (%s, 'user', %s)",
            (user_id, message),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _mark_escalated(chat_id: int, user_id: int, summary: str):
    """Kind-B handoff (session state): flag the chat and bridge into support_messages.

    The ticket itself is filed via the create_ticket MCP tool (REST + JWT) — this
    only touches chat-session state, mirroring how _persist works.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE chats SET escalated = true, status = 'escalated' WHERE id = %s AND user_id = %s",
            (chat_id, user_id),
        )
        cur.execute(
            "INSERT INTO support_messages (user_id, sender_type, message) VALUES (%s, 'user', %s)",
            (user_id, f"[Escalated from chatbot] {summary}"),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


# --------------------------------------------------------------------------- #
# Streaming helpers (unchanged from Phase 1)
# --------------------------------------------------------------------------- #

def _worker_from_ns(ns: str) -> str | None:
    """Return the worker name if this checkpoint namespace belongs to a worker
    subgraph, else None. Each worker is a `create_react_agent` subgraph nested
    under a parent node named after the worker, so a streamed chunk carries a ns
    like "order:<uuid>|agent:<uuid>". The router streams under "router:<uuid>"
    → None (filtered). We scan every "|"-separated segment."""
    if not ns:
        return None
    for seg in ns.split("|"):
        head = seg.split(":", 1)[0]
        if head in WORKER_NODES:
            return head
    return None


def _text(content) -> str:
    if isinstance(content, list):
        return "".join(
            p.get("text", "") if isinstance(p, dict) else str(p) for p in content
        )
    return content or ""


def _chunk_text(chunk) -> str:
    """Extract streamed assistant text from an AIMessageChunk (OpenAI + Gemini shapes)."""
    txt = getattr(chunk, "text", None)
    if callable(txt):
        txt = txt()
    if txt:
        return txt
    return _text(getattr(chunk, "content", ""))


def _bridge(agen):
    """Drive an async generator to completion on a dedicated event loop, yielding
    each item synchronously — the Flask-sync ↔ async-graph bridge (Phase 0/1)."""
    loop = asyncio.new_event_loop()
    try:
        while True:
            try:
                yield loop.run_until_complete(agen.__anext__())
            except StopAsyncIteration:
                break
    finally:
        loop.run_until_complete(agen.aclose())
        loop.close()


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


# --------------------------------------------------------------------------- #
# Confirmation-gated + escalation local tools (HITL — must run in-process)
# --------------------------------------------------------------------------- #

def make_confirm_tool(action_name, mcp_tool, summarize):
    """Wrap an MCP write tool so it pauses for user confirmation before executing.

    `interrupt()` must run inside the graph process, so this local tool is what an
    agent calls; on approval it invokes the real REST-backed MCP write tool. The
    wrapper mirrors the underlying MCP tool's name / description / args schema so
    the LLM sees exactly the same interface (and passes the same arguments)."""
    async def _gated(**kwargs) -> str:
        decision = interrupt({
            "kind": "confirm",
            "action": action_name,
            "args": kwargs,
            "summary": summarize(kwargs),
        })
        if not (isinstance(decision, dict) and decision.get("approved")):
            return "User declined; no action taken."
        result = await mcp_tool.ainvoke(kwargs)
        return f"Done. {result}"

    return StructuredTool.from_function(
        coroutine=_gated,
        name=action_name,
        description=(getattr(mcp_tool, "description", "") or action_name),
        args_schema=getattr(mcp_tool, "args_schema", None),
    )


def make_escalate_tool(chat_id: int, user_id: int, create_ticket_tool):
    """Support agent's immediate (no-confirm) hand-off to a human."""
    @tool("escalate_to_human")
    async def _escalate(summary: str, reason: str = "handoff") -> str:
        """Escalate this conversation to a human support agent. `summary` is a
        short description of the issue; `reason` is e.g. 'handoff' | 'complaint' |
        'abuse'. Files a ticket and connects the user to a human."""
        # File a ticket via REST (golden rule) — best-effort.
        try:
            if create_ticket_tool is not None:
                await create_ticket_tool.ainvoke({
                    "subject": (summary[:200] or "Escalation"),
                    "category": reason,
                    "chat_id": chat_id,
                })
        except Exception:
            pass
        _mark_escalated(chat_id, user_id, summary)
        return ("Escalated to a human agent. Let the user know a human will "
                "continue with them here shortly.")

    return _escalate


# --------------------------------------------------------------------------- #
# Graph
# --------------------------------------------------------------------------- #

def _build_graph(llm, tools, checkpointer, chat_id: int, user_id: int):
    """Compile the recall → router → worker graph over live MCP tools, with the
    write agents' tools wrapped in confirmation gates and the support agent given
    an escalate-to-human tool."""
    by_name = {t.name: t for t in tools}

    def raw(names):
        return [by_name[n] for n in names if n in by_name]

    def gated(names):
        out = []
        for n in names:
            if n in by_name:
                out.append(make_confirm_tool(n, by_name[n], GATE_SUMMARIES[n]))
        return out

    create_ticket_tool = by_name.get("create_ticket")
    escalate_tool = make_escalate_tool(chat_id, user_id, create_ticket_tool)

    def tools_for(name):
        t = raw(AGENT_READ.get(name, ()))
        t += gated(AGENT_GATED.get(name, ()))
        if name == "support":
            # create_ticket / upload_attachment need no gate; escalate is immediate.
            t += raw(("create_ticket", "upload_attachment"))
            t.append(escalate_tool)
        return t

    agents = {
        name: create_react_agent(llm, tools_for(name), prompt=WORKER_PROMPTS[name])
        for name in WORKER_PROMPTS
    }

    router_llm = llm.with_structured_output(Route)

    async def recall_node(state: ChatState) -> dict:
        # Phase 2: belt-and-suspenders escalation mirror (hard silence is enforced
        # in /chat/stream). Mem0 / rolling summary land in Phase 3.
        return {"escalated": _is_escalated(state.get("chat_id", chat_id))}

    async def router_node(state: ChatState) -> dict:
        res = await router_llm.ainvoke(
            [("system", ROUTER_PROMPT), ("human", _text(state["messages"][-1].content))]
        )
        intent = res.intent if res.intent in INTENTS else "faq"
        if res.confidence < CONFIDENCE_THRESHOLD:
            intent = "faq"  # low confidence degrades to FAQ/General
        return {"active_agent": intent, "router_confidence": res.confidence}

    def make_worker(name):
        async def node(state: ChatState) -> dict:
            out = await agents[name].ainvoke({"messages": state["messages"]})
            return {"messages": out["messages"][-1:], "active_agent": name}
        return node

    g = StateGraph(ChatState)
    g.add_node("recall", recall_node)
    g.add_node("router", router_node)
    for name in WORKER_PROMPTS:
        g.add_node(name, make_worker(name))

    g.add_edge(START, "recall")
    g.add_edge("recall", "router")
    g.add_conditional_edges(
        "router", lambda s: s["active_agent"], {name: name for name in WORKER_PROMPTS}
    )
    for name in WORKER_PROMPTS:
        g.add_edge(name, END)
    return g.compile(checkpointer=checkpointer)


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@chat_bp.route("/stream", methods=["POST"])
@token_required
def stream(user):
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    session_id = data.get("session_id")
    auth = request.headers.get("Authorization", "")
    jwt = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else ""

    if not message:
        return {"error": "message required"}, 400

    chat_id = _get_or_create_chat(user["id"], session_id)

    # Bot-silent-on-escalated-thread: once a chat is escalated, the human takes
    # over via /support/*. Route further messages into the support inbox and
    # signal the widget to switch to the Human tab.
    if _is_escalated(chat_id):
        _bridge_to_support(user["id"], message)

        def one_shot():
            yield f"event: session\ndata: {json.dumps({'session_id': chat_id})}\n\n"
            yield f"event: escalated\ndata: {json.dumps({'session_id': chat_id})}\n\n"
            yield "event: done\ndata: {}\n\n"

        return Response(stream_with_context(one_shot()),
                        mimetype="text/event-stream", headers=SSE_HEADERS)

    _persist(chat_id, "user", message)

    async def agen():
        client = MultiServerMCPClient({
            "ecommerce": {
                "url": MCP_URL,
                "transport": "streamable_http",
                "headers": {"Authorization": f"Bearer {jwt}"},
            }
        })
        tools = await client.get_tools()
        llm = ChatOpenAI(model=CHAT_MODEL, temperature=0.3)

        config = {"configurable": {"thread_id": str(chat_id)}}

        # A fresh AsyncPostgresSaver bound to THIS request's event loop; the
        # paused state persists in Neon so /chat/resume (a separate request /
        # loop) can pick it up.
        async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as saver:
            graph = _build_graph(llm, tools, saver, chat_id, user["id"])

            yield f"event: session\ndata: {json.dumps({'session_id': chat_id})}\n\n"

            full = []
            active_agent = "faq"
            async for _ns_tuple, (chunk, meta) in graph.astream(
                {
                    "messages": [("human", message)],
                    "user_id": user["id"],
                    "jwt": jwt,
                    "chat_id": chat_id,
                },
                config=config,
                stream_mode="messages",
                subgraphs=True,
            ):
                worker = _worker_from_ns(meta.get("langgraph_checkpoint_ns", ""))
                if worker is None:
                    continue
                active_agent = worker
                if isinstance(chunk, AIMessageChunk):
                    token = _chunk_text(chunk)
                    if token:
                        full.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"

            # Did the graph pause on an interrupt (HITL Kind A) rather than finish?
            state = await graph.aget_state(config)
            pending = [i for t in state.tasks for i in (getattr(t, "interrupts", None) or [])]
            if pending:
                payload = pending[0].value
                _persist(chat_id, "assistant",
                         f"[awaiting confirmation: {payload.get('summary', '')}]",
                         agent=active_agent)
                yield f"event: interrupt\ndata: {json.dumps(payload)}\n\n"
                return

            # If the chat was escalated during this turn, tell the widget.
            if _is_escalated(chat_id):
                answer = "".join(full)
                if answer.strip():
                    _persist(chat_id, "assistant", answer, agent=active_agent)
                yield f"event: escalated\ndata: {json.dumps({'session_id': chat_id})}\n\n"
                yield "event: done\ndata: {}\n\n"
                return

            answer = "".join(full)
            _persist(chat_id, "assistant", answer, agent=active_agent)
            yield "event: done\ndata: {}\n\n"

    return Response(stream_with_context(_bridge(agen())),
                    mimetype="text/event-stream", headers=SSE_HEADERS)


@chat_bp.route("/resume", methods=["POST"])
@token_required
def resume(user):
    data = request.get_json() or {}
    session_id = data.get("session_id")
    approved = bool(data.get("approved"))
    auth = request.headers.get("Authorization", "")
    jwt = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else ""

    if not session_id:
        return {"error": "session_id required"}, 400

    # Ownership: the chat must belong to this user (also normalizes the id).
    chat_id = _get_or_create_chat(user["id"], session_id)
    config = {"configurable": {"thread_id": str(chat_id)}}

    async def agen():
        client = MultiServerMCPClient({
            "ecommerce": {
                "url": MCP_URL,
                "transport": "streamable_http",
                "headers": {"Authorization": f"Bearer {jwt}"},
            }
        })
        tools = await client.get_tools()
        llm = ChatOpenAI(model=CHAT_MODEL, temperature=0.3)

        async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as saver:
            graph = _build_graph(llm, tools, saver, chat_id, user["id"])

            yield f"event: session\ndata: {json.dumps({'session_id': chat_id})}\n\n"

            full = []
            active_agent = "faq"
            async for _ns_tuple, (chunk, meta) in graph.astream(
                Command(resume={"approved": approved}),
                config=config,
                stream_mode="messages",
                subgraphs=True,
            ):
                worker = _worker_from_ns(meta.get("langgraph_checkpoint_ns", ""))
                if worker is None:
                    continue
                active_agent = worker
                if isinstance(chunk, AIMessageChunk):
                    token = _chunk_text(chunk)
                    if token:
                        full.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"

            # A resume can itself hit another interrupt (rare here).
            state = await graph.aget_state(config)
            pending = [i for t in state.tasks for i in (getattr(t, "interrupts", None) or [])]
            if pending:
                payload = pending[0].value
                _persist(chat_id, "assistant",
                         f"[awaiting confirmation: {payload.get('summary', '')}]",
                         agent=active_agent)
                yield f"event: interrupt\ndata: {json.dumps(payload)}\n\n"
                return

            # Escalation could also happen mid-resume.
            if _is_escalated(chat_id):
                answer = "".join(full)
                if answer.strip():
                    _persist(chat_id, "assistant", answer, agent=active_agent)
                yield f"event: escalated\ndata: {json.dumps({'session_id': chat_id})}\n\n"
                yield "event: done\ndata: {}\n\n"
                return

            answer = "".join(full)
            _persist(chat_id, "assistant", answer, agent=active_agent)
            yield "event: done\ndata: {}\n\n"

    return Response(stream_with_context(_bridge(agen())),
                    mimetype="text/event-stream", headers=SSE_HEADERS)
