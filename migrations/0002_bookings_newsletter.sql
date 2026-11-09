-- D1 migration 0002: ensure the booking and newsletter tables exist.
-- Safe to apply to an existing database: CREATE TABLE IF NOT EXISTS does not
-- replace, clear, or modify existing rows or existing table definitions.
-- Existing tables with a different column layout are handled by db.js by
-- checking the available columns before inserting optional fields.
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
