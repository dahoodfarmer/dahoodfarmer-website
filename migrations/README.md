# D1 Migration Target Map

The sponsor, Opportunity Network and Stripe Invoicing features use the main application D1 database binding `DB`. The current Stripe Invoicing design does not require a separate payment-ledger database.

## Main application database — binding `DB`

Apply these migrations to the isolated Preview main application database in order:

- `0004_opportunity_network.sql` — private applications and approved public business directory.
- `0005_opportunity_products.sql` — server-controlled Opportunity Network product catalog; seeded products remain draft.
- `0006_sponsor_crm.sql` — sponsor pipeline, agreements, payment status, deliverables and activity history.
- `0007_sponsor_invoices.sql` — owner-issued sponsor invoice records.
- `0008_stripe_invoicing.sql` — Stripe customer/invoice references, hosted invoice URLs and webhook event audit.
- `0009_sponsor_prospect_pipeline.sql` — outbound sponsor, corporate and media prospect CRM.

Current Preview target: `dahoodfarmer-preview-db`  
Preview database ID: `ca5786b1-751e-4cee-b595-3a4b60061cc9`

## Payment database note

The earlier experimental `PAYMENTS_DB` ledger is not used by the current Stripe Invoicing implementation and is not bound in this branch's Wrangler configuration. Its Preview test database may still contain dormant tables from prior work; do not use it for current sponsor invoice processing.

## Important safeguards

- The Preview `DB` binding points to `dahoodfarmer-preview-db`.
- The Preview `SESSIONS` binding points to `dahoodfarmer-preview-sessions`.
- Stripe invoice/customer IDs, hosted invoice URLs and webhook events are stored in the main Preview `DB`.
- Production has separate bindings and has not received these migrations as part of this work.
- Do not apply Preview migrations to Production without a separate review and explicit owner approval.
- Never copy Preview test credentials or invoice data into Production.
