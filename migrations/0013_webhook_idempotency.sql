-- Durable Stripe webhook idempotency and safe retry state.
-- Existing event rows are treated as completed so previously reconciled events are not replayed.
ALTER TABLE payment_provider_events ADD COLUMN status TEXT NOT NULL DEFAULT 'processed'
  CHECK (status IN ('processing','processed','failed'));
ALTER TABLE payment_provider_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1);
ALTER TABLE payment_provider_events ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE payment_provider_events ADD COLUMN last_error TEXT;
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_status
  ON payment_provider_events(provider_id, status, updated_at);
