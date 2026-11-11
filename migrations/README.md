# D1 Migration Target Map

This repository uses two separate D1 databases. Do **not** blindly apply every SQL file in this directory to both bindings.

## Main application database — binding `DB`

Apply these migrations to the main application D1 database:

- `0004_opportunity_network.sql` — private applications and approved public business directory.
- `0005_opportunity_products.sql` — server-controlled Opportunity Network product catalog; all seeded products remain draft.\n- `0006_land_experiences_catalog.sql` — adds the `experiences` catalog category while preserving all existing product records; seeds no unapproved prices or offers. The catalog may legitimately return zero active Land & Experiences offers until the owner approves a specific offer and its terms.

Current Preview target: `dahoodfarmer-preview-db`  
Preview database ID: `ca5786b1-751e-4cee-b595-3a4b60061cc9`

## Payment ledger database — binding `PAYMENTS_DB`

Apply this migration only to the dedicated payment ledger database:

- `0003_dhf_payment_engine.sql` — payment orders and webhook event ledger.

Current Preview target: `dahoodfarmer-payments-test`  
Preview database ID: `3ea269d0-4333-42d1-8fd6-43f42f62d708`

## Important safeguards

- The Preview `DB` binding points to `dahoodfarmer-preview-db`.
- The Preview `SESSIONS` binding points to `dahoodfarmer-preview-sessions`.
- The Preview `PAYMENTS_DB` binding points to `dahoodfarmer-payments-test`.
- Production has its own `DB` and `SESSIONS` bindings and currently has no `PAYMENTS_DB` binding.
- Do not apply Preview migrations to Production as part of routine QA.
- Do not run `0003_dhf_payment_engine.sql` against the main application database.
- Do not run `0004_opportunity_network.sql` or `0005_opportunity_products.sql` against the payment ledger database.
- Before any future Production release, review each migration against its explicit target database and obtain the required owner approval.

The separate migration targets are documented here because the current repository stores both databases' SQL files under one top-level `migrations/` folder. A future cleanup may split them into per-binding migration directories, but do not move already-applied migration files without a deliberate migration-history plan.
