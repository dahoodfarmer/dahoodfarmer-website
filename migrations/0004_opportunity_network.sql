-- D1 migration 0004: DHF Opportunity Network intake and public directory.
-- Additive only. Does not alter or delete existing contact, booking, newsletter, or commerce records.

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_type TEXT NOT NULL CHECK (
    application_type IN (
      'business_listing',
      'vendor',
      'sponsor',
      'speaker',
      'academy',
      'property_partner',
      'membership'
    )
  ),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  requested_package TEXT NOT NULL DEFAULT '',
  event_interest TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  public_description TEXT NOT NULL DEFAULT '',
  contact_consent INTEGER NOT NULL DEFAULT 0 CHECK (contact_consent IN (0, 1)),
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0, 1)),
  public_listing_consent INTEGER NOT NULL DEFAULT 0 CHECK (public_listing_consent IN (0, 1)),
  source_path TEXT NOT NULL DEFAULT '/',
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'reviewing', 'contacted', 'approved', 'declined')
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opportunity_applications_status
  ON opportunity_applications(status, created_at);

CREATE INDEX IF NOT EXISTS idx_opportunity_applications_type
  ON opportunity_applications(application_type, created_at);

CREATE INDEX IF NOT EXISTS idx_opportunity_applications_email
  ON opportunity_applications(email);

CREATE INDEX IF NOT EXISTS idx_opportunity_applications_country
  ON opportunity_applications(country, region);

CREATE TABLE IF NOT EXISTS business_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('active', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  FOREIGN KEY (application_id) REFERENCES opportunity_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_listings_status_category
  ON business_listings(status, category, business_name);

CREATE INDEX IF NOT EXISTS idx_business_listings_country
  ON business_listings(status, country, region);
