# DHF Payment Center — Preview Setup

**Environment:** Cloudflare Pages Preview only.  
**Production:** No production database, secret, DNS, webhook, or deployment changes are included.

## Isolated Preview resources

| Binding | Resource | ID |
|---|---|---|
| DB | dahoodfarmer-preview-db | ca5786b1-751e-4cee-b595-3a4b60061cc9 |
| SESSIONS | dahoodfarmer-preview-sessions | 2218d0643bab47e0b1bd46fd0e473637 |

The Pages project production branch remains `site-rebuild-v2`. The current payment work is on `feature/dhf-provider-neutral-payment-center`; its deployment is a Preview deployment.

## Payment and receipt controls

| Variable | Preview setting | Purpose |
|---|---|---|
| DHF_PAYMENTS_ENABLED | `false` | Master payment kill switch |
| DHF_PAYMENT_PROVIDER | `none` | No provider selected |
| DHF_PAYMENT_METHODS | Empty | No payment method advertised as available |
| DHF_INVOICING_ENABLED | `false` | Sponsor invoice creation disabled |
| DHF_CHECKOUT_ENABLED | `false` | General checkout disabled |
| DHF_STRIPE_EXPECT_LIVEMODE | `false` | Reject live-mode expectations |
| DHF_RECEIPT_TOKEN_SECRET | Preview secret required; minimum 32 random characters | HMAC key for opaque receipt URLs |
| DHF_RECEIPT_EMAIL_ENABLED | `false` | Receipt email kill switch |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Not configured | Email delivery remains unavailable |
| PUBLIC_SITE_URL | `https://dahoodfarmer.com` | Base URL for customer receipt links |

The Preview configuration contains Stripe secret bindings, but Cloudflare masks their values. The application now enforces the configured Stripe API-key mode before outbound API calls and rejects webhook events whose `livemode` flag does not match `DHF_STRIPE_EXPECT_LIVEMODE`. The actual key mode and webhook-secret pairing still require an authenticated provider test; no Stripe API request or payment transaction has been performed. Do not infer test-mode readiness from the existence of a secret binding alone.

A paid webhook is deliberately rejected with a retryable error until the dedicated receipt-token secret is present. Receipt email remains off even when a receipt is created.

## Migrations

Apply to the isolated Preview main DB in order:

- `0006_sponsor_crm.sql`
- `0007_sponsor_invoices.sql`
- `0008_stripe_invoicing.sql`
- `0009_sponsor_prospect_pipeline.sql`
- `0010_provider_neutral_payments.sql`
- `0011_provider_customer_reference.sql`
- `0012_payment_receipts.sql`

Do not apply these migrations to Production without separate review and explicit owner approval. The previous experimental `PAYMENTS_DB` is not used by this sponsor-invoice design.

## Current behavior

- Sponsor inquiries and pipeline can be reviewed in the private CRM.
- Invoice creation requires a signed agreement, contracted stage, agreed server-side amount, valid billing contact, and future due date.
- Invoice issuing is blocked unless a provider is explicitly selected and the master payment and invoice flags are enabled.
- The Payment Center is informational only; Apple Pay, cards, and ACH are shown as not activated.
- The provider adapter contract and Stripe invoice adapter are implemented, but no provider is activated and no transaction is submitted.
- QR codes are not generated until a secure opaque invoice URL exists.
- Migration 0012 adds a durable receipt ledger. A verified paid webhook creates at most one receipt per invoice; the owner ledger exposes the corresponding customer receipt page.
- Receipt email delivery is implemented but remains disabled. No Resend sender credentials are configured, and no customer email has been sent.
- The owner ledger is read-only. It does not create invoices, initiate charges, or issue refunds.

## Verification completed

- Migrations 0010, 0011, and 0012 are applied to the isolated Preview database only.
- Preview D1 checks show zero invoice, receipt, and partnership records. This explains the zero totals currently displayed; it is an empty test ledger, not evidence of real-world payments.
- `PRAGMA foreign_key_check` returned no rows.
- Current Preview deployment `05f7c78d-b418-4c11-9cf0-6c818abb0189` completed successfully.
- GitHub Actions Website CI run #225 completed successfully on commit `12d2c5c877f9d2ead5ed6a48d6eea24b2e9e87c0`.
- Production and Preview Access audiences are distinct, and the Preview/Production D1 and KV bindings are isolated.
- Payment, invoicing, checkout, and receipt email flags remain disabled.

## Remaining Preview gates

1. Confirm the dedicated receipt-token secret is present in Preview and keep the email switch off.
2. Verify the Stripe account and matching Preview test-mode API/webhook credentials without exposing secret values or creating a duplicate account.
3. Run a synthetic invoice-to-paid-webhook-to-receipt test in Stripe test mode, including duplicate-event/idempotency checks.
4. Verify customer receipt rendering and owner-ledger reconciliation against the same synthetic record.
5. Exercise refund and payment-failure handling. ACH/bank-transfer support requires a provider capability check and a separate reconciliation test; it must not be advertised as active until verified.

No Production release, live payment activation, customer email delivery, or real-money transaction is authorized by this Preview setup.
