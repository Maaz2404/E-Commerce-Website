-- Phase 2: support tickets (complaints, damaged/missing items, escalations).
CREATE TABLE IF NOT EXISTS tickets (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    chat_id         INTEGER REFERENCES chats(id),    -- links an escalated chat, nullable
    subject         TEXT NOT NULL,
    category        VARCHAR(40),                      -- damaged|missing|complaint|other
    priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    attachment_path TEXT,                             -- relative path under backend/uploads/
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id);
