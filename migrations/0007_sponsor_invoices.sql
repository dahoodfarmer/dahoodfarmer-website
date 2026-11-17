-- Main application DB: sponsor invoices issued after an owner-approved signed agreement.
-- This migration is separate from the PAYMENTS_DB migrations.
CREATE TABLE IF NOT EXISTS sponsor_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL UNIQUE,
  partnership_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  description TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','pending','paid','expired','void')),
  token_hash TEXT NOT NULL UNIQUE,
  payment_order_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (partnership_id) REFERENCES sponsor_partnerships(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_partnership
  ON sponsor_invoices(partnership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_status
  ON sponsor_invoices(status, due_date);
