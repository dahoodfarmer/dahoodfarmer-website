-- Add Stripe Invoicing references to the sponsor CRM.
-- Invoicing remains disabled until tax treatment, test-mode credentials and webhook setup are approved.
ALTER TABLE sponsor_partnerships ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN stripe_invoice_id TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN hosted_invoice_url TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN invoice_pdf_url TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN invoice_number TEXT;
ALTER TABLE sponsor_invoices ADD COLUMN stripe_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE sponsor_invoices ADD COLUMN refund_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_amount_cents >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_invoices_stripe_invoice
  ON sponsor_invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
