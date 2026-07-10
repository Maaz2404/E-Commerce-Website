
"""RAG tool — the one allowed direct-DB tool (read-only over the shared KB)."""
from langchain_openai import OpenAIEmbeddings

from database import get_connection

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536  # MUST match vector(1536) in migration 0004 and ingest_kb.py.

# Lazy embedder so importing this module never requires OPENAI_API_KEY.
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = OpenAIEmbeddings(model=EMBED_MODEL)
    return _embedder


def register(mcp):
    @mcp.tool()
    async def search_knowledge_base(query: str, k: int = 5) -> list[dict]:
        """Semantic search over the support knowledge base.

        Use for FAQ / shipping / returns / warranty / policy questions. Returns the
        top-k most relevant KB chunks with a similarity score.
        """
        qvec = _get_embedder().embed_query(query)
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
