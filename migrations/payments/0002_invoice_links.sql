-- Apply only to PAYMENTS_DB after 0001_payment_engine.sql.
ALTER TABLE dhf_payment_orders ADD COLUMN invoice_id TEXT;
ALTER TABLE dhf_payment_orders ADD COLUMN partnership_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_dhf_payment_orders_invoice ON dhf_payment_orders(invoice_id, created_at DESC);
