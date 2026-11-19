-- Provider-neutral payment metadata for the DHF sponsor platform.
-- Additive only; this migration does not enable payment collection.
ALTER TABLE sponsor_partnerships ADD COLUMN payment_provider_id TEXT NOT NULL DEFAULT 'unconfigured'
  CHECK (payment_provider_id IN ('unconfigured','stripe','flo','manual'));
ALTER TABLE sponsor_invoices ADD COLUMN provider_id TEXT NOT NULL DEFAULT 'unconfigured'
  CHECK (provider_id IN ('unconfigured','stripe','flo','manual'));
ALTER TABLE sponsor_invoices ADD COLUMN provider_invoice_id TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN provider_status TEXT NOT NULL DEFAULT 'unconfigured';
ALTER TABLE sponsor_invoices ADD COLUMN payment_method TEXT
  CHECK (payment_method IS NULL OR payment_method IN ('apple_pay','card','ach','bank_transfer'));
ALTER TABLE sponsor_invoices ADD COLUMN provider_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_invoices_provider_invoice
  ON sponsor_invoices(provider_id, provider_invoice_id) WHERE provider_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_provider_status
  ON sponsor_invoices(provider_id, provider_status, status);
CREATE TABLE IF NOT EXISTS payment_provider_events (
  provider_id TEXT NOT NULL CHECK (provider_id IN ('stripe','flo','manual')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider_id, event_id)
);
