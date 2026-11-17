# DHF Payment Center — Preview Setup

**Environment:** Cloudflare Pages Preview only.
**Production:** No production database, secret, DNS, webhook or deployment changes are included.

## Preview bindings

| Binding | Resource | ID |
|---|---|---|
| DB | dahoodfarmer-preview-db | ca5786b1-751e-4cee-b595-3a4b60061cc9 |
| SESSIONS | dahoodfarmer-preview-sessions | 2218d0643bab47e0b1bd46fd0e473637 |

## Payment flags

| Variable | Preview value | Purpose |
|---|---|---|
| DHF_PAYMENTS_ENABLED | false | Master payment kill switch |
| DHF_PAYMENT_PROVIDER | none | No provider selected |
| DHF_PAYMENT_METHODS | empty | No payment method advertised as available |
| DHF_INVOICING_ENABLED | false | Sponsor invoice creation disabled |
| DHF_CHECKOUT_ENABLED | false | General checkout disabled |
| DHF_STRIPE_EXPECT_LIVEMODE | false | Existing Stripe test-mode expectation; no live-mode use |
| DHF_RECEIPT_TOKEN_SECRET | Secret, at least 32 random characters | HMAC key for unguessable receipt URLs; do not commit or expose it |
| DHF_RECEIPT_EMAIL_ENABLED | false | Automatic receipt email kill switch; leave disabled until owner approval |
| RESEND_API_KEY | Secret, not currently configured | Email provider API credential; never put in source control |
| RESEND_FROM_EMAIL | Verified sender address, not currently configured | Approved sender identity |
| PUBLIC_SITE_URL | https://dahoodfarmer.com | Public base URL used to build receipt links |

Existing Preview Stripe secret and webhook-secret bindings were previously observed, but their values and actual modes are not exposed here. Their presence does not enable payment processing. No payment API call or transaction has been made as part of this work.

## Migrations

Apply to the isolated Preview main DB in order:
- 0006_sponsor_crm.sql
- 0007_sponsor_invoices.sql
- 0008_stripe_invoicing.sql
- 0009_sponsor_prospect_pipeline.sql
- 0010_provider_neutral_payments.sql
- 0011_provider_customer_reference.sql
- 0012_payment_receipts.sql

Do not apply these migrations to Production without separate review and explicit owner approval. The previous experimental PAYMENTS_DB is not used by this sponsor-invoice design.

## Current behavior

- Sponsor inquiries and pipeline can be reviewed in the private CRM.
- Invoice creation requires a signed agreement, contracted stage, agreed server-side amount, valid billing contact and future due date.
- Invoice issuing is blocked unless a provider is explicitly selected and the master payments and invoice flags are enabled.
- The Payment Center is informational only; Apple Pay, cards and ACH are shown as not activated.
- The provider adapter contract and Stripe invoice adapter are implemented, but no provider is activated and no transaction is submitted.
- QR codes are not yet generated; a QR is added only after a secure opaque invoice URL exists.
- Migration 0012 adds a durable receipt ledger. Verified paid webhooks create one receipt per invoice; the owner ledger exposes the matching customer receipt page.
- Receipt email delivery is implemented behind DHF_RECEIPT_EMAIL_ENABLED and defaults off. No Resend sender credentials are currently configured; no customer email is sent in this milestone. The owner must separately approve sender identity, configure the secrets, test delivery, and explicitly enable the email flag.
- Migration 0012 adds a durable, invoice-idempotent receipt ledger. Verified paid webhooks create a branded customer receipt URL; the owner ledger exposes receipt links.
- Customer receipt email delivery is not active. The current repository has no configured Resend sender credentials; no email is sent by this milestone. Configure and separately approve an email sender before enabling automatic receipt delivery.

## Preview verification completed

- Migrations 0010 and 0011 were applied on November 17, 2026 to the isolated Preview main DB `dahoodfarmer-preview-db` only.
- Verified the provider invoice/customer columns, provider-event table and both provider indexes.
- `PRAGMA foreign_key_check` returned no rows after migration 0010. No Production database was touched.
- Preview payment flags remain disabled; no provider is selected and no payment methods are active.

## Remaining Preview gates

1. Run the full GitHub Actions test suite and review the result.
3. Confirm the protected Preview can be opened by the owner for mobile visual review.
4. If the owner chooses Stripe, verify the existing account and Preview test-mode keys without creating a duplicate account. If the owner chooses FLO, obtain its written API/acquirer specifications first.
5. Complete test-mode payment, webhook, refund and ACH/bank-transfer reconciliation tests only after separate authorization to configure and test the provider.

No Production release or live payment activation is authorized by this Preview setup.
