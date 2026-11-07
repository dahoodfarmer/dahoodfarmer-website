-- ============================================================
-- D1 Safe Migration — APPLY step
-- Run ONLY the statements below that correspond to missing
-- tables/columns identified by the inspection queries in migration.sql
-- Each statement is safe to run individually.
-- ============================================================

-- === TABLES: Create only if missing ===
-- These use CREATE TABLE IF NOT EXISTS — safe even if table exists
-- BUT if the table exists without all columns, the columns won't be added.
-- Use the ALTER TABLE statements below for missing columns.

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT DEFAULT '',
  inquiry_type TEXT NOT NULL,
  preferred_date TEXT DEFAULT '',
  details TEXT DEFAULT '',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT,
  consent_at TEXT,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- === COLUMNS: Add only if missing ===
-- Run each ALTER TABLE ONLY if the inspection query shows the column is missing.
-- Do NOT run blindly — check the pragma_table_info output first.
-- If a column already exists, the ALTER TABLE will error with "duplicate column name"
-- and that error is harmless but should be avoided by checking first.

-- Run this ONLY if newsletter_subscribers exists but is missing consent_at:
-- ALTER TABLE newsletter_subscribers ADD COLUMN consent_at TEXT;

-- Run this ONLY if newsletter_subscribers exists but is missing unsubscribe_token:
-- ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT;

-- === INDEXES: Create only if missing ===
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_events_id ON processed_events(event_id);

-- === VERIFY: Count records after migration to confirm no data loss ===
SELECT 'contacts' as tbl, COUNT(*) as cnt FROM contacts
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'newsletter_subscribers', COUNT(*) FROM newsletter_subscribers;
