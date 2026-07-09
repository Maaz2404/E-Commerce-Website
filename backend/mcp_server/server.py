"""FastMCP sidecar (:8900), streamable-HTTP transport.

Phase 0 tools:
  - get_orders            : user-scoped, calls Flask REST with the caller's JWT.
  - search_knowledge_base : shared-KB read; the one allowed direct-DB tool.

JWT propagation: the chat blueprint (MCP client) forwards the end-user's
`Authorization: Bearer <jwt>` header on the MCP connection. Each user-scoped
tool receives a `Context` and reads that header from the underlying HTTP request.
"""
import os
import sys

# Make sibling backend modules (database, client) importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

# Avoid a FAISS/OpenMP conflict on macOS if a native lib is pulled in.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from mcp.server.fastmcp import Context, FastMCP
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from mcp_server.client import rest_get
from database import get_connection

EMBED_DIM = 768

mcp = FastMCP("ecommerce", host="0.0.0.0", port=8900)

# Lazy embedder so importing this module never requires GOOGLE_API_KEY.
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    return _embedder


def _jwt_from_ctx(ctx: Context) -> str:
    """Pull the caller's bearer token from the incoming MCP HTTP request."""
    try:
        request = ctx.request_context.request
        auth = request.headers.get("authorization", "") if request else ""
    except Exception:
        auth = ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1]
    return ""


@mcp.tool()
async def get_orders(ctx: Context) -> list[dict]:
    """List the current user's orders (order history)."""
    jwt = _jwt_from_ctx(ctx)
    if not jwt:
        return {"error": "missing authorization"}
    return await rest_get("/orders/", jwt)


@mcp.tool()
async def search_knowledge_base(query: str, k: int = 5) -> list[dict]:
    """Semantic search over the support knowledge base.

    Use for FAQ / shipping / returns / warranty / policy questions. Returns the
    top-k most relevant KB chunks with a similarity score.
    """
    qvec = _get_embedder().embed_query(query, output_dimensionality=EMBED_DIM)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT source, title, content, 1 - (embedding <=> %s::vector) AS score
        FROM kb_documents
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (str(qvec), str(qvec), k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
