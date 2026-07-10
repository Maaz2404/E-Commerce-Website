-- Transcript persistence (memory layer 3b) + audit / handoff source of truth.
-- NOTE: references users(id). On the existing Neon DB, users already exists.
-- Migrations run before init_db() creates users, so on a truly fresh DB this
-- FK would fail — ensure users exists first if that ever bites.
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active',   -- active | closed | escalated
  escalated BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,             -- user | assistant | tool
  content TEXT,
  agent VARCHAR(40),
  tool_calls JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id);
