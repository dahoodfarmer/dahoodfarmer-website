# D1 Migration Target Map

The sponsor, Opportunity Network and provider-neutral Payment Center features use the main application D1 database binding `DB`. The current sponsor-invoice design does not require a separate payment-ledger database.

## Main application database — binding `DB`

Apply these migrations to the isolated Preview main application database in order:

- `0004_opportunity_network.sql` — private applications and approved public business directory.
- `0005_opportunity_products.sql` — server-controlled Opportunity Network product catalog; seeded products remain draft.
- `0006_sponsor_crm.sql` — sponsor pipeline, agreements, payment status, deliverables and activity history.
- `0007_sponsor_invoices.sql` — owner-issued sponsor invoice records.
- `0008_stripe_invoicing.sql` — legacy Stripe-specific invoice references retained for compatibility.
- `0009_sponsor_prospect_pipeline.sql` — outbound sponsor, corporate and media prospect CRM.
- `0010_provider_neutral_payments.sql` — provider IDs, generic invoice references, payment methods and provider-event audit.
- `0011_provider_customer_reference.sql` — provider-neutral customer reference for sponsor partnerships.
- `0012_payment_receipts.sql` — durable, invoice-idempotent customer receipt ledger.
- `0013_webhook_idempotency.sql` — durable webhook processing states, duplicate suppression and safe retry tracking.
- `0014_one_open_invoice_per_partnership.sql` — unique partial index preventing concurrent or repeated issuance of multiple active invoices for one partnership.

Current Preview target: `dahoodfarmer-preview-db`  
Preview database ID: `ca5786b1-751e-4cee-b595-3a4b60061cc9`

## Payment database note

The earlier experimental `PAYMENTS_DB` ledger is not used by the current sponsor-invoice implementation and is not bound in this branch's Wrangler configuration. Its Preview test database may still contain dormant tables from prior work; do not use it for current sponsor invoice processing.

## Important safeguards

- The Preview `DB` binding points to `dahoodfarmer-preview-db`.
- The Preview `SESSIONS` binding points to `dahoodfarmer-preview-sessions`.
- Provider invoice references, hosted invoice URLs and payment-provider event records are stored in the main Preview `DB`. Legacy Stripe-specific columns remain for compatibility.
- Production has separate bindings and has not received these migrations as part of this work.
- Do not apply Preview migrations to Production without a separate review and explicit owner approval.
- Never copy Preview test credentials or invoice data into Production.
