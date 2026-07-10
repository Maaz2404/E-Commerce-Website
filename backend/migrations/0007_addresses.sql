-- Phase 2: user shipping addresses.
CREATE TABLE IF NOT EXISTS addresses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    label       VARCHAR(40),
    line1       TEXT NOT NULL,
    line2       TEXT,
    city        VARCHAR(80),
    postal_code VARCHAR(20),
    country     VARCHAR(80),
    phone       VARCHAR(30),
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses (user_id);
