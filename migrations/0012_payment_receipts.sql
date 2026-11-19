-- DHF receipt ledger: additive and disabled until a verified payment event creates a receipt.
-- Apply to Preview first; never apply to Production without separate owner approval.
CREATE TABLE IF NOT EXISTS payment_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL UNIQUE,
  partnership_id INTEGER NOT NULL,
  receipt_token_hash TEXT NOT NULL UNIQUE,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('apple_pay','card','ach','bank_transfer','other')),
  provider_id TEXT NOT NULL CHECK (provider_id IN ('stripe','flo','manual')),
  provider_reference TEXT NOT NULL DEFAULT '',
  processor_fee_cents INTEGER CHECK (processor_fee_cents IS NULL OR processor_fee_cents >= 0),
  net_amount_cents INTEGER CHECK (net_amount_cents IS NULL OR net_amount_cents >= 0),
  paid_at TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (email_status IN ('not_configured','pending','sent','failed','not_requested')),
  emailed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES sponsor_invoices(invoice_id) ON DELETE RESTRICT,
  FOREIGN KEY (partnership_id) REFERENCES sponsor_partnerships(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_paid_at ON payment_receipts(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_partnership ON payment_receipts(partnership_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_recipient ON payment_receipts(recipient_email, paid_at DESC);
