-- APEX first-party analytics. Stores event metadata only; never stores prompts or response text.
CREATE TABLE IF NOT EXISTS apex_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  specialist TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  latency_ms INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apex_events_created ON apex_events(created_at);
CREATE INDEX IF NOT EXISTS idx_apex_events_conversation ON apex_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_apex_events_type ON apex_events(event_type);

CREATE TABLE IF NOT EXISTS apex_feedback (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('helpful','not_helpful')),
  category TEXT CHECK (category IN ('accuracy','relevance','clarity','other')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apex_feedback_created ON apex_feedback(created_at);
