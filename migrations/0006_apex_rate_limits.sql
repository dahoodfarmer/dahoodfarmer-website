-- Atomic, privacy-preserving APEX visitor rate limits. The key is a salted hash, never a raw IP.
CREATE TABLE IF NOT EXISTS apex_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apex_rate_limits_updated ON apex_rate_limits(updated_at);
