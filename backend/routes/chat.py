"""Chat blueprint — Phase 1.

Replaces Phase 0's single ReAct agent with a real router-dispatched multi-agent
`StateGraph`:

    START → recall → router → {order|product|promotion|account|payment|faq} → persist → END

- **router**: a `gpt-4o-mini` structured-output call returns {intent, confidence}.
  Low confidence (or unknown intent) degrades to the FAQ/General agent — the
  Support & Escalation agent is Phase 2.
- **workers**: five read-only `create_react_agent` nodes, each with a scoped MCP
  tool allow-list, plus Phase 0's FAQ/General agent kept as the fallback.
- **recall**: Phase 1 pass-through (Mem0 / rolling summary land in Phase 3).
- **persist**: appends the assistant turn tagged with the worker that handled it.

The SSE contract (`event: session` → `data: {"token": ...}` → `event: done`),
the `MultiServerMCPClient` JWT forwarding, and the async→sync bridge are all
kept from Phase 0. Only worker-node tokens are streamed, so the router's
classification call never leaks tokens to the user.

Flask is sync WSGI; LangGraph + MCP are async. The SSE generator drives the
async token stream through a dedicated event loop, pumping one item at a time.
"""
import os
import json
import asyncio
from typing import TypedDict, Annotated

from flask import Blueprint, request, Response, stream_with_context
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessageChunk
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.prebuilt import create_react_agent

from auth_middleware import token_required
from database import get_connection

chat_bp = Blueprint("chat", __name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8900") + "/mcp"

# Chat + router model (OpenAI). Override with the CHAT_MODEL env var.
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")

CONFIDENCE_THRESHOLD = 0.5
INTENTS = ["order", "product", "promotion", "account", "payment", "faq"]

ROUTER_PROMPT = (
    "Classify the user's latest message into exactly one intent:\n"
    "- order: track/status of a specific order\n"
    "- product: availability, specs, comparison, product search\n"
    "- promotion: coupons / active discounts\n"
    "- account: the user's own order history / profile\n"
    "- payment: payment status, double/duplicate charge questions\n"
    "- faq: greetings, small talk, policy questions, anything else\n"
    "Return the intent and your confidence (0..1)."
)

WORKER_PROMPTS = {
    "order": (
        "You are the Order agent for our e-commerce store (prices in PKR). "
        "Answer only about the user's own orders using the order tools "
        "(get_orders, get_order). To track a specific order, call get_order with "
        "its id and report the status, total, and items. Be concise and friendly."
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
        "coupons via list_active_coupons. Do NOT claim a coupon is valid for a "
        "specific cart — that check is not available yet. Be concise and friendly."
    ),
    "account": (
        "You are the Account agent (prices in PKR). Answer questions about the "
        "user's own order history using get_orders. Be concise and friendly."
    ),
    "payment": (
        "You are the Payment agent (prices in PKR). Report payment status using "
        "the payment tools. To check for a double charge on an order, call "
        "get_order_payments and inspect the rows: if two payments with status "
        "'success' share the same order_id and amount, flag a likely double "
        "charge and suggest the user contact support to resolve it. Otherwise "
        "reassure them there is only one charge. Be concise and friendly."
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

# Which MCP tool names each agent may use (must match mcp_server/tools/* exactly).
AGENT_ALLOW = {
    "order":     ("get_orders", "get_order"),
    "product":   ("search_products", "get_product", "search_knowledge_base"),
    "promotion": ("list_active_coupons",),
    "account":   ("get_orders",),
    "payment":   ("get_payments", "get_payment_status", "get_order_payments"),
    "faq":       ("search_knowledge_base", "get_orders"),
}

WORKER_NODES = set(WORKER_PROMPTS)  # nodes whose tokens we stream to the user


class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: int
    jwt: str                  # threaded to every MCP tool call
    active_agent: str         # which worker handled this turn (persisted)
    router_confidence: float  # low → FAQ/General fallback


class Route(BaseModel):
    intent: str = Field(description=f"one of {INTENTS}")
    confidence: float = Field(description="0..1 certainty")


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


def _worker_from_ns(ns: str) -> str | None:
    """Return the worker name if this checkpoint namespace belongs to a worker
    subgraph, else None.

    Each worker is a `create_react_agent` subgraph nested under a parent node
    named after the worker (e.g. "order"), so a streamed chunk from inside it
    carries a checkpoint namespace like "order:<uuid>|agent:<uuid>". The router
    runs its `with_structured_output` call directly in the "router" node, so its
    JSON streams under "router:<uuid>" and returns None here (filtered out). We
    scan every "|"-separated segment so we match whether the parent prefix is
    present or only the inner segment is."""
    if not ns:
        return None
    for seg in ns.split("|"):
        head = seg.split(":", 1)[0]
        if head in WORKER_NODES:
            return head
    return None


def _text(content) -> str:
    """Flatten Gemini's list-of-parts content into a plain string."""
    if isinstance(content, list):
        return "".join(
            p.get("text", "") if isinstance(p, dict) else str(p) for p in content
        )
    return content or ""


def _chunk_text(chunk) -> str:
    """Extract streamed assistant text from an AIMessageChunk.

    With langchain-core 1.x + langchain-google-genai 4.x, a tool-capable model
    leaves `chunk.content` as "" and exposes the text via the `.text` property
    (backed by `content_blocks` of type "text"). Tool-call chunks yield "".
    Fall back to flattening `.content` for older shapes.
    """
    txt = getattr(chunk, "text", None)
    if callable(txt):  # some versions expose text() as a method
        txt = txt()
    if txt:
        return txt
    return _text(getattr(chunk, "content", ""))


def _build_graph(llm, tools):
    """Compile the recall → router → worker → persist graph over live MCP tools."""
    by_name = {t.name: t for t in tools}

    def scoped(names):
        return [by_name[n] for n in names if n in by_name]

    agents = {
        name: create_react_agent(llm, scoped(AGENT_ALLOW[name]), prompt=WORKER_PROMPTS[name])
        for name in WORKER_PROMPTS
    }

    router_llm = llm.with_structured_output(Route)

    async def recall_node(state: ChatState) -> dict:
        # Phase 1 pass-through; Mem0 / rolling summary land in Phase 3.
        return {}

    async def router_node(state: ChatState) -> dict:
        res = await router_llm.ainvoke(
            [("system", ROUTER_PROMPT), ("human", _text(state["messages"][-1].content))]
        )
        intent = res.intent if res.intent in INTENTS else "faq"
        if res.confidence < CONFIDENCE_THRESHOLD:
            intent = "faq"  # degrade to FAQ/General (escalation is Phase 2)
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
    return g.compile()


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
    _persist(chat_id, "user", message)

    async def agen():
        # Connect to the MCP sidecar, forwarding the end-user's JWT so tool
        # calls inherit exactly this user's REST-layer permissions.
        client = MultiServerMCPClient({
            "ecommerce": {
                "url": MCP_URL,
                "transport": "streamable_http",
                "headers": {"Authorization": f"Bearer {jwt}"},
            }
        })
        tools = await client.get_tools()

        llm = ChatOpenAI(model=CHAT_MODEL, temperature=0.3)
        graph = _build_graph(llm, tools)

        # Emit the session id first so the widget can persist it.
        yield f"event: session\ndata: {json.dumps({'session_id': chat_id})}\n\n"

        full = []
        active_agent = "faq"
        # Each worker is a `create_react_agent` subgraph; its LLM tokens only
        # surface through the parent stream when subgraphs=True, which changes
        # the event shape to (namespace_tuple, (chunk, meta)). The worker's own
        # name is the checkpoint-namespace prefix (e.g. "order:<uuid>|agent:..");
        # the router runs `with_structured_output` directly in the "router" node,
        # so its JSON classification streams under ns "router:..." and is filtered
        # out by _worker_from_ns (which returns None for it) — no router tokens
        # ever reach the user.
        async for _ns_tuple, (chunk, meta) in graph.astream(
            {"messages": [("human", message)], "user_id": user["id"], "jwt": jwt},
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

        answer = "".join(full)
        _persist(chat_id, "assistant", answer, agent=active_agent)
        yield "event: done\ndata: {}\n\n"

    def sync_stream():
        loop = asyncio.new_event_loop()
        g = agen()
        try:
            while True:
                try:
                    yield loop.run_until_complete(g.__anext__())
                except StopAsyncIteration:
                    break
        finally:
            loop.run_until_complete(g.aclose())
            loop.close()

    return Response(
        stream_with_context(sync_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
