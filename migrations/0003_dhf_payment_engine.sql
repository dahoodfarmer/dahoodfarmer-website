-- DHF Payment Engine foundation. Additive only; does not modify existing tables.
CREATE TABLE IF NOT EXISTS dhf_payment_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_session_id TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('support','product','service','invoice')),
  description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount >= 100),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','expired','refunded')),
  customer_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dhf_payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dhf_payment_orders_status ON dhf_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_dhf_payment_orders_created ON dhf_payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_dhf_payment_orders_session ON dhf_payment_orders(provider_session_id);
