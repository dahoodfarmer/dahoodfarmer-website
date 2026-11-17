# Payment data migrations

These migrations are applied to the isolated `PAYMENTS_DB` database, not the main `DB` database.

1. `migrations/payments/0001_payment_engine.sql`
2. `migrations/payments/0002_invoice_links.sql`

The sponsor invoice table is in the main application database migration `migrations/0007_sponsor_invoices.sql`.

Never run payment migrations against Production during Preview testing. The Preview payment database is `dahoodfarmer-payments-test` (`3ea269d0-4333-42d1-8fd6-43f42f62d708`). Production must receive a separately provisioned payment database and explicit owner approval before any live payment launch.
