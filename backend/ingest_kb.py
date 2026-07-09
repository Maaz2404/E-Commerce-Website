"""Offline KB ingestion for the RAG knowledge base.

Reads .md/.txt files under a KB directory, chunks them, embeds each chunk with
`gemini-embedding-001` (768-dim, matching the vector(768) migration), and upserts
into `kb_documents`. Re-runnable and idempotent: dedupes by (source, chunk_hash).

Usage:
    uv run python ingest_kb.py [kb_dir]   # default kb_dir = "kb"

Requires GOOGLE_API_KEY in the environment / .env.
"""
import os
import sys
import glob
import hashlib

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from database import get_connection

load_dotenv()

EMBED_DIM = 768  # MUST match vector(768) in the migration and the query-embed call.
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    return _embedder


def chunk(text: str, size: int = 1000, overlap: int = 150):
    text = text.strip()
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i + size])
        i += size - overlap
    return [c for c in out if c.strip()]


def ingest_file(path: str):
    source = os.path.basename(path)
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    chunks = chunk(raw)
    if not chunks:
        print(f"{source}: no content, skipped")
        return
    vectors = _get_embedder().embed_documents(chunks, output_dimensionality=EMBED_DIM)
    conn = get_connection()
    cur = conn.cursor()
    inserted = 0
    for content, vec in zip(chunks, vectors):
        h = hashlib.sha256(content.encode()).hexdigest()
        cur.execute(
            """
            INSERT INTO kb_documents (source, title, content, chunk_hash, embedding, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (source, chunk_hash) DO NOTHING
            """,
            (source, source, content, h, str(vec), None),
        )
        inserted += cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    print(f"{source}: {inserted} new chunks (of {len(chunks)})")


if __name__ == "__main__":
    kb_dir = sys.argv[1] if len(sys.argv) > 1 else "kb"
    files = glob.glob(os.path.join(kb_dir, "**", "*.*"), recursive=True)
    files = [f for f in files if f.lower().endswith((".md", ".txt"))]
    if not files:
        print(f"No .md/.txt KB files under {kb_dir}/")
        sys.exit(1)
    for f in sorted(files):
        ingest_file(f)
