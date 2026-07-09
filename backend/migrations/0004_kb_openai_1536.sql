-- Switch the RAG store from Gemini (768-dim) to OpenAI text-embedding-3-small
-- (1536-dim). The old vectors are not comparable, so we drop the cosine index,
-- clear the table, widen the column, and rebuild the index. The KB must be
-- re-ingested afterwards (`uv run python ingest_kb.py kb`).
DROP INDEX IF EXISTS idx_kb_embedding;

-- old 768-dim rows can't coexist with a 1536 column; clear them
TRUNCATE TABLE kb_documents;

ALTER TABLE kb_documents
  ALTER COLUMN embedding TYPE vector(1536);

CREATE INDEX IF NOT EXISTS idx_kb_embedding
  ON kb_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
