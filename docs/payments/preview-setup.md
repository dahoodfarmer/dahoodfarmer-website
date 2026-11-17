# DHF Sponsor Invoice Checkout — Preview Setup

**Environment:** Cloudflare Pages Preview only.
**Production:** No production binding, database, secret, DNS or deployment changes are part of this work.

## Preview resources

| Binding | Resource | ID |
|---|---|---|
| `DB` | `dahoodfarmer-preview-db` | `ca5786b1-751e-4cee-b595-3a4b60061cc9` |
| `SESSIONS` | `dahoodfarmer-preview-sessions` | `2218d0643bab47e0b1bd46fd0e473637` |
| `PAYMENTS_DB` | `dahoodfarmer-payments-test` | `3ea269d0-4333-42d1-8fd6-43f42f62d708` |

The Sponsor CRM and invoice migrations are applied to the isolated Preview main DB. Payment ledger migrations are applied only to the Preview `PAYMENTS_DB`.

## Migrations

Main application DB:
- `migrations/0006_sponsor_crm.sql`
- `migrations/0007_sponsor_invoices.sql`

Payment ledger DB:
- `migrations/payments/0001_payment_engine.sql`
- `migrations/payments/0002_invoice_links.sql`

Never apply the payment-ledger migrations to the main application DB or Production.

## Required Preview variables

| Name | Type | State |
|---|---|---|
| `DHF_CHECKOUT_ENABLED` | Plain text | `false` |
| `STRIPE_SECRET_KEY` | Secret | Secret binding exists; value and mode not exposed |
| `STRIPE_WEBHOOK_SECRET` | Secret | Secret binding exists; value and mode not exposed |
| `STRIPE_PUBLISHABLE_KEY` | Plain text | Not present in the inspected Preview metadata |

Do not retrieve or print secret values. A matching Stripe **test-mode** publishable key is required before checkout can be exercised. Do not add live-mode keys to Preview.

## Current operational behavior

- Sponsor applications can be reviewed and converted into CRM partnership records.
- A secure invoice link can be generated only after a signed agreement and agreed amount are recorded.
- Invoice amount is server-side and cannot be changed by the browser.
- Public invoice details are limited to payment-relevant fields.
- Checkout returns HTTP 503 while `DHF_CHECKOUT_ENABLED=false` or matching Stripe keys are unavailable.
- A verified webhook is required before the CRM marks a sponsor payment as paid.
- No real or test card transaction has been submitted as part of this implementation.

## Production gate

Production requires a separately provisioned `PAYMENTS_DB`, production schema application, production Stripe secrets and webhook, business/payout onboarding, customer disclosures, tested reconciliation and explicit owner approval. Do not enable live payments as part of this Preview work.
