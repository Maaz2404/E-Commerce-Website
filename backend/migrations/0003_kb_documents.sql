-- RAG store for the knowledge base (FAQ / shipping / returns / warranty policies).
-- Embedding dimension is 768 — MUST match ingest_kb.py and the query-embed call.
CREATE TABLE IF NOT EXISTS kb_documents (
  id SERIAL PRIMARY KEY,
  source VARCHAR(255),          -- file / doc origin
  title TEXT,
  content TEXT NOT NULL,
  chunk_hash VARCHAR(64),       -- for dedupe on re-ingest
  embedding vector(768),        -- MUST match the embed dimension used everywhere
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- one row per (source, chunk) so re-ingest is idempotent
CREATE UNIQUE INDEX IF NOT EXISTS uq_kb_source_chunk
  ON kb_documents (source, chunk_hash);

-- cosine similarity index. ivfflat needs data before it's effective; fine to
-- create empty. Tune `lists` after ingesting real volume.
CREATE INDEX IF NOT EXISTS idx_kb_embedding
  ON kb_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
