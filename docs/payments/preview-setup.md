# DHF Stripe Invoicing — Preview Setup

**Environment:** Cloudflare Pages Preview only.
**Production:** No production database, secret, DNS, webhook or deployment changes are included.

## Preview bindings

| Binding | Resource | ID |
|---|---|---|
| `DB` | `dahoodfarmer-preview-db` | `ca5786b1-751e-4cee-b595-3a4b60061cc9` |
| `SESSIONS` | `dahoodfarmer-preview-sessions` | `2218d0643bab47e0b1bd46fd0e473637` |

The sponsor CRM and Stripe invoice schema are applied only to the isolated Preview main DB.

## Required Preview variables

| Name | Type | State |
|---|---|---|
| `DHF_INVOICING_ENABLED` | Plain text | `false` |
| `DHF_CHECKOUT_ENABLED` | Plain text | `false` (future non-invoice checkout gate) |
| `STRIPE_SECRET_KEY` | Secret | Secret binding exists; actual value and mode are not exposed |
| `STRIPE_WEBHOOK_SECRET` | Secret | Secret binding exists; actual value and event subscriptions are not exposed |

A Stripe publishable key is not required for Stripe-hosted invoice pages. Do not enable invoicing until the secret is confirmed to be a test-mode key in Preview and tax treatment is approved.

## Migrations

Apply to the Preview main DB in order:
- `0006_sponsor_crm.sql`
- `0007_sponsor_invoices.sql`
- `0008_stripe_invoicing.sql`

The previous experimental `PAYMENTS_DB` schema is unused by this Stripe Invoicing design and is not bound by the current branch.

## Current behavior

- Sponsor inquiries and CRM pipeline can be reviewed.
- Invoice creation requires a signed agreement, contracted stage, agreed amount, billing email and owner-selected future due date.
- Invoice issuing returns HTTP 503 while `DHF_INVOICING_ENABLED=false).
- If enabled after approval, the backend creates a Stripe hosted invoice and does not email the sponsor automatically.
- Only verified invoice webhooks can mark the sponsor payment as paid.
- No test or live transaction has been submitted as part of this implementation.

## Production gate

Production requires a separately reviewed Stripe configuration, production webhook endpoint and secret, production schema application, tax decision, customer terms, refund policy, end-to-end test and explicit owner approval. Never enable live invoicing as part of Preview work.
