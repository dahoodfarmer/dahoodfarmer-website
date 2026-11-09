-- One-time, non-destructive migration.
-- Adds a consent timestamp for new newsletter signups. Existing rows remain unchanged
-- and retain NULL because historical consent timestamps were not recorded.
ALTER TABLE newsletter_subscribers ADD COLUMN consent_at TEXT;
