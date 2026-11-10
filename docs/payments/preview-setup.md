# DHF Payment Engine — Preview Setup

This setup is for the isolated test environment only.

## Preview resources

- Cloudflare Pages project: `dahoodfarmer-website`
- Feature branch: `feature/dhf-payment-engine-foundation`
- Preview D1 binding: `PAYMENTS_DB`
- Preview database: `dahoodfarmer-payments-test`
- Migration: `migrations/0003_dhf_payment_engine.sql`
- Preview webhook: `https://feature-dhf-payment-engine-f.dahoodfarmer-website.pages.dev/api/payments/webhook`

The test database is separate from the production D1 database. The production Pages environment has not been given a `PAYMENTS_DB` binding.

## Preview environment variables

Set these in Cloudflare Pages → Settings → Variables and Secrets → Preview:

| Variable | Type | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret | Stripe test-mode secret key |
| `STRIPE_PUBLISHABLE_KEY` | Plain text | Matching Stripe test-mode publishable key |
| `STRIPE_WEBHOOK_SECRET` | Secret | Test webhook signing secret |

The preview webhook endpoint is registered in Stripe test mode and subscribes only to:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Never use live-mode keys in Preview. Do not copy secrets into Git or source files.

## Test sequence

1. Confirm the preview environment is using matching `pk_test_` and `sk_test_` credentials.
2. Open the branch preview at `/pay`.
3. Create a low-value test contribution using Stripe's test card numbers.
4. Confirm Checkout completes and the return page shows the verified result.
5. Confirm the D1 order changes to `paid` and a webhook event is recorded.
6. Test a declined payment, expired session, and duplicate webhook delivery.
7. Confirm the production database and live website remain unchanged.

## Production gate

Production requires a separate production `PAYMENTS_DB` binding and the production migration, live-mode Stripe credentials, a production webhook endpoint, wallet/domain setup, customer disclosures, and explicit owner approval. Do not switch the preview configuration to live mode.
