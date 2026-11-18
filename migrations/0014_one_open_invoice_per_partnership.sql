-- Prevent concurrent/repeated invoice issuance from creating multiple active invoices for one partnership.
-- Existing issued/pending duplicates must be resolved before applying this migration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_invoices_one_open_per_partnership
  ON sponsor_invoices(partnership_id)
  WHERE status IN ('issued','pending');
