"""Chat blueprint — Phase 0.

A minimal LangGraph ReAct agent (the FAQ / General agent) that:
  - greets and handles small talk (story 30),
  - answers FAQ / policy questions from the KB via the `search_knowledge_base`
    MCP tool (story 28),
streamed to the widget token-by-token over SSE, with the full transcript
persisted to `chats` / `chat_messages`.

Later phases replace the single agent with the recall → router → 9-agent graph.

Flask is sync WSGI; LangGraph + MCP are async. The SSE generator drives the
async token stream through a dedicated event loop, pumping one item at a time.
"""
import os
import json
import asyncio

from flask import Blueprint, request, Response, stream_with_context
from langchain_core.messages import AIMessageChunk
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

from auth_middleware import token_required
from database import get_connection

chat_bp = Blueprint("chat", __name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8900") + "/mcp"

SYSTEM = (
    "You are the customer-support assistant for our e-commerce store (all prices in PKR). "
    "Greet warmly and handle greetings and small talk naturally. "
    "For any product, order, shipping, returns, refunds, warranty, payment, coupon, account, "
    "or policy question, you MUST call the search_knowledge_base tool and answer ONLY from what "
    "it returns. If the knowledge base has nothing relevant, say you're not sure and offer to "
    "connect the customer with a human agent. Never invent policies, prices, or delivery times. "
    "Keep answers concise and friendly."
)


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
        # Phase 0 FAQ/General agent gets only the read-only KB + orders tools.
        allow = {"search_knowledge_base", "get_orders"}
        scoped = [t for t in tools if t.name in allow]

        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
        graph = create_react_agent(llm, scoped, prompt=SYSTEM)

        # Emit the session id first so the widget can persist it.
        yield f"event: session\ndata: {json.dumps({'session_id': chat_id})}\n\n"

        full = []
        async for chunk, meta in graph.astream(
            {"messages": [("human", message)]},
            stream_mode="messages",
        ):
            # Only stream assistant text from the model node (skip tool messages).
            if isinstance(chunk, AIMessageChunk):
                token = chunk.content
                if isinstance(token, list):  # Gemini may emit content parts
                    token = "".join(
                        p.get("text", "") if isinstance(p, dict) else str(p)
                        for p in token
                    )
                if token:
                    full.append(token)
                    yield f"data: {json.dumps({'token': token})}\n\n"

        answer = "".join(full)
        _persist(chat_id, "assistant", answer, agent="faq")
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
