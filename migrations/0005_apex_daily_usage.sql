CREATE TABLE IF NOT EXISTS apex_daily_usage (
  usage_date TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
