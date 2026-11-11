# DHF Payment Engine — Preview Setup

This setup is for the isolated test environment only.

## Preview resources

- Cloudflare Pages project: `dahoodfarmer-website`
- Feature branch: `feature/dhf-payment-engine-foundation`
- Preview branch host: `feature-dhf-payment-engine-f.dahoodfarmer-website.pages.dev`
- Main application D1 binding: `DB` → `dahoodfarmer-preview-db` (`ca5786b1-751e-4cee-b595-3a4b60061cc9`)
- Session/rate-limit KV binding: `SESSIONS` → `dahoodfarmer-preview-sessions` (`2218d0643bab47e0b1bd46fd0e473637`)
- Payment ledger D1 binding: `PAYMENTS_DB` → `dahoodfarmer-payments-test` (`3ea269d0-4333-42d1-8fd6-43f42f62d708`)
- Payment migration: `migrations/0003_dhf_payment_engine.sql`

The Preview `DB` and `SESSIONS` bindings were explicitly corrected to use isolated resources. The payment ledger remains separate in `PAYMENTS_DB`. Production retains its own `DB` and `SESSIONS` bindings and has no `PAYMENTS_DB` binding. Do not test or submit forms against any deployment until its bindings are confirmed.

## Preview environment variables

Set these in Cloudflare Pages → Settings → Variables and Secrets → Preview:

| Variable | Type | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret | Stripe test-mode secret key |
| `STRIPE_PUBLISHABLE_KEY` | Plain text | Matching Stripe test-mode publishable key |
| `STRIPE_WEBHOOK_SECRET` | Secret | Test webhook signing secret |

The payment branch also uses the existing Preview Turnstile site/secret configuration for other public forms. The payment endpoint checks same-origin requests and allows the exact DHF production hosts plus project Pages Preview hosts. Contact, booking and newsletter handlers derive Turnstile's expected hostname from the active request rather than a fixed old Preview alias.

Never use live-mode keys in Preview. Do not copy secrets into Git or source files. Metadata checks may confirm a secret binding is present; never retrieve or display its value.

## Current payment scope

- The public payment page is test-mode support contributions only.
- Product, service and invoice purposes are rejected by the server.
- No public ticket, vendor, sponsor, directory or workshop checkout products are active.
- Product/service checkout requires a trusted server-side catalog and application/order association; the browser must never set the final price.
- No live payment, refund, production binding or production schema operation has been performed.

## Automated verification

The branch now includes Node's built-in test runner and mocked payment tests covering:
- Missing payment configuration and invalid amount/purpose.
- Cross-origin and unauthorized-host rejection.
- Stripe Checkout session creation and order persistence.
- Stripe API failure and orphan-session expiry.
- Webhook signature validation and order/amount reconciliation.
- Payment status reconciliation.

These tests mock Stripe and D1. They do not submit live or test-card transactions. Do not ask the user to perform a manual checkout unless a specific remaining defect cannot be verified otherwise.

## Production gate

Production requires a separate production `PAYMENTS_DB` binding and the production migration, live-mode Stripe credentials, a production webhook endpoint, wallet/domain setup, customer disclosures, and explicit owner approval. Do not switch the Preview configuration to live mode.
