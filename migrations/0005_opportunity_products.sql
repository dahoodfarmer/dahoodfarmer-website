-- D1 migration 0005: server-controlled DHF Opportunity Network product catalog.
-- Additive only. All seeded offers remain draft and cannot be purchased until checkout is integrated and enabled.

CREATE TABLE IF NOT EXISTS opportunity_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  funnel TEXT NOT NULL CHECK (funnel IN ('business','summits','marketplace','academy','sponsors')),
  product_type TEXT NOT NULL CHECK (product_type IN ('service','event_ticket','digital','vendor_booth','sponsorship','training')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 100 AND price_cents <= 10000000),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0,1)),
  required_application_type TEXT NOT NULL DEFAULT '' CHECK (
    required_application_type IN ('','business_listing','vendor','sponsor','speaker','academy','property_partner','membership')
  ),
  max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity BETWEEN 1 AND 50),
  inventory_limit INTEGER CHECK (inventory_limit IS NULL OR inventory_limit > 0),
  inventory_sold INTEGER NOT NULL DEFAULT 0 CHECK (inventory_sold >= 0),
  sort_order INTEGER NOT NULL DEFAULT 100,
  available_from TEXT,
  available_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (inventory_limit IS NULL OR inventory_sold <= inventory_limit),
  CHECK (requires_approval = 0 OR required_application_type <> '')
);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_status_funnel
  ON opportunity_products(status, funnel, sort_order);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_slug
  ON opportunity_products(slug);

INSERT OR IGNORE INTO opportunity_products
(product_id, slug, funnel, product_type, name, description, price_cents, status, requires_approval, required_application_type, max_quantity, sort_order)
VALUES
('business-featured-profile-12mo','featured-business-profile','business','service','Featured Business Profile — 12 Months','A featured business directory placement for an approved applicant. Paid placement will be labeled.',7500,'draft',1,'business_listing',1,10),
('business-spotlight-interview','business-spotlight-interview','business','service','Business Spotlight Interview','A sponsored business interview and profile feature, subject to review and scheduling.',15000,'draft',1,'business_listing',1,20),
('summit-general-admission','summit-general-admission','summits','event_ticket','Summit — General Admission','General admission to a specified DHF virtual summit. Event details must be published before activation.',2000,'draft',0,'',10,10),
('summit-vip-admission','summit-vip-admission','summits','event_ticket','Summit — VIP Admission','VIP access to a specified DHF summit with benefits defined on the event page before activation.',7500,'draft',0,'',10,20),
('marketplace-virtual-exhibitor','virtual-exhibitor-profile','marketplace','digital','Virtual Exhibitor Profile','A standard digital exhibitor profile for an approved vendor at a specified event.',7500,'draft',1,'vendor',5,10),
('marketplace-featured-exhibitor','featured-digital-exhibitor','marketplace','digital','Featured Digital Exhibitor','Enhanced digital showcase placement for an approved vendor at a specified event.',12500,'draft',1,'vendor',5,20),
('marketplace-standard-booth','standard-vendor-booth','marketplace','vendor_booth','Standard Vendor Booth','An in-person vendor booth. Activate only after venue, capacity, permits and insurance are confirmed.',15000,'draft',1,'vendor',1,30),
('marketplace-premium-booth','premium-vendor-booth','marketplace','vendor_booth','Premium Vendor Booth','Premium in-person vendor placement. Activate only after venue, floor plan and safety requirements are confirmed.',25000,'draft',1,'vendor',1,40),
('academy-live-workshop','academy-live-workshop','academy','training','Live Virtual Workshop','Admission to a specified DHF Academy live workshop. Curriculum, instructor and date must be confirmed before activation.',4900,'draft',0,'',10,10),
('academy-multi-session','academy-multi-session-program','academy','training','Multi-Session Learning Program','Admission to a specified multi-session educational program. Curriculum and schedule must be confirmed before activation.',14900,'draft',0,'',10,20),
('sponsor-community-partner','sponsor-community-partner','sponsors','sponsorship','Community Partner Sponsorship','Proposed pilot sponsorship package; final benefits and event inventory require written agreement.',25000,'draft',1,'sponsor',1,10),
('sponsor-supporting','sponsor-supporting','sponsors','sponsorship','Supporting Sponsor','Proposed pilot sponsorship package; final benefits and event inventory require written agreement.',50000,'draft',1,'sponsor',1,20),
('sponsor-founding','sponsor-founding','sponsors','sponsorship','Founding Sponsor','Proposed pilot sponsorship package; final benefits and event inventory require written agreement.',100000,'draft',1,'sponsor',1,30),
('sponsor-presenting','sponsor-presenting','sponsors','sponsorship','Presenting Partner','Proposed pilot sponsorship package; final benefits and event inventory require written agreement.',250000,'draft',1,'sponsor',1,40);
