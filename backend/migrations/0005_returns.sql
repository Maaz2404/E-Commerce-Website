-- Phase 2: returns / exchanges. One row per return or exchange request.
CREATE TABLE IF NOT EXISTS returns (
    id            SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(id),
    user_id       INTEGER NOT NULL REFERENCES users(id),
    type          VARCHAR(10) NOT NULL DEFAULT 'return',    -- 'return' | 'exchange'
    reason        TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'requested', -- requested|approved|rejected|refunded|completed
    refund_amount NUMERIC(12,2),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns (user_id);
