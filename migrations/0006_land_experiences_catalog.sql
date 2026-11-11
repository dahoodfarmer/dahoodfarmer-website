-- D1 migration 0006: add the Land & Experiences catalog category.
-- Main application DB binding only. This is additive at the data level:
-- existing product IDs, prices, statuses, inventory and timestamps are preserved.
-- No new offer is seeded and no draft price is invented.

CREATE TABLE opportunity_products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  funnel TEXT NOT NULL CHECK (funnel IN ('business','summits','marketplace','academy','experiences','sponsors')),
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

INSERT INTO opportunity_products_new (
  id, product_id, slug, funnel, product_type, name, description, price_cents,
  currency, status, requires_approval, required_application_type, max_quantity,
  inventory_limit, inventory_sold, sort_order, available_from, available_until,
  created_at, updated_at
)
SELECT
  id, product_id, slug, funnel, product_type, name, description, price_cents,
  currency, status, requires_approval, required_application_type, max_quantity,
  inventory_limit, inventory_sold, sort_order, available_from, available_until,
  created_at, updated_at
FROM opportunity_products;

DROP TABLE opportunity_products;
ALTER TABLE opportunity_products_new RENAME TO opportunity_products;

CREATE INDEX idx_opportunity_products_status_funnel
  ON opportunity_products(status, funnel, sort_order);

CREATE INDEX idx_opportunity_products_slug
  ON opportunity_products(slug);
