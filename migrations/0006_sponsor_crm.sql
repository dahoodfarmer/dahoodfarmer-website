-- D1 migration 0006: sponsor CRM, agreement tracking, deliverables and activity history.
-- Apply only to the main application DB binding (DB), never PAYMENTS_DB.
-- Additive only; does not alter existing applications, products, contacts or orders.

CREATE TABLE IF NOT EXISTS sponsor_partnerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL UNIQUE,
  division TEXT NOT NULL DEFAULT 'business_network' CHECK (division IN ('business_network','summits_events','marketplace','academy','land_experiences','advertising_media')),
  stage TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN ('prospect','qualified','proposal_draft','proposal_sent','negotiating','contracted','fulfilling','completed','renewal_due','closed_lost')),
  package_name TEXT NOT NULL DEFAULT '',
  proposed_amount_cents INTEGER CHECK (proposed_amount_cents IS NULL OR proposed_amount_cents BETWEEN 100 AND 100000000),
  agreed_amount_cents INTEGER CHECK (agreed_amount_cents IS NULL OR agreed_amount_cents BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  contract_status TEXT NOT NULL DEFAULT 'not_started' CHECK (contract_status IN ('not_started','draft','sent','signed','declined')),
  contract_url TEXT NOT NULL DEFAULT '',
  contract_signed_at TEXT,
  payment_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (payment_status IN ('not_requested','invoice_sent','pending','paid','failed','refunded')),
  invoice_url TEXT NOT NULL DEFAULT '',
  payment_reference TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  renewal_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_partnerships_stage
  ON sponsor_partnerships(stage, updated_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_partnerships_renewal
  ON sponsor_partnerships(renewal_date, stage);

CREATE TABLE IF NOT EXISTS sponsor_deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partnership_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','waived')),
  evidence_url TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (partnership_id) REFERENCES sponsor_partnerships(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sponsor_deliverables_due
  ON sponsor_deliverables(partnership_id, status, due_date);

CREATE TABLE IF NOT EXISTS sponsor_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partnership_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note','email','call','meeting','proposal','contract','payment','follow_up')),
  summary TEXT NOT NULL,
  follow_up_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (partnership_id) REFERENCES sponsor_partnerships(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sponsor_activities_recent
  ON sponsor_activities(partnership_id, created_at DESC);
