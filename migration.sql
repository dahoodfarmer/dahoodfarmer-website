-- ============================================================
-- D1 Safe Migration for dahoodfarmer-website
-- This file is READ-ONLY inspection only — run these queries first
-- to determine what columns and tables already exist.
-- Then run only the specific ALTER/CREATE statements from
-- migration_apply.sql that are needed based on the results.
-- ============================================================

-- STEP 1: Read-only inspection — run these queries first

-- List all existing tables and their CREATE statements
SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;

-- List all existing indexes
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;

-- Inspect contacts table columns (check for: id, name, email, subject, message, ip_address, created_at, status)
SELECT name, type, "notnull", dflt_value FROM pragma_table_info('contacts');

-- Inspect bookings table columns (check for: id, name, email, organization, inquiry_type, preferred_date, details, ip_address, created_at, status)
SELECT name, type, "notnull", dflt_value FROM pragma_table_info('bookings');

-- Inspect newsletter_subscribers table columns (check for: id, email, unsubscribe_token, consent_at, subscribed_at, status)
-- CRITICAL: Check if consent_at and unsubscribe_token columns exist
SELECT name, type, "notnull", dflt_value FROM pragma_table_info('newsletter_subscribers');

-- Check if orders table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='orders';

-- Check if processed_events table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='processed_events';

-- Count existing records (to verify no data loss after migration)
SELECT 'contacts' as tbl, COUNT(*) as cnt FROM contacts
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'newsletter_subscribers', COUNT(*) FROM newsletter_subscribers;
