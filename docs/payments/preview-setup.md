# DHF Payment Center — Preview Setup

**Environment:** Cloudflare Pages Preview only.  
**Production:** No production database, secret, DNS, deployment or payment activation changes.

## Isolated Preview resources

| Binding | Resource | ID |
|---|---|---|
| DB | dahoodfarmer-preview-db | ca5786b1-751e-4cee-b595-3a4b60061cc9 |
| SESSIONS | dahoodfarmer-preview-sessions | 2218d0643bab47e0b1bd46fd0e473637 |

The production branch remains `site-rebuild-v2`. Payment work is on `feature/dhf-provider-neutral-payment-center`.

## Preview controls

| Variable | Preview setting | Purpose |
|---|---|---|
| DHF_INTERNAL_INVOICING_ENABLED | true | Allow DHF-owned invoice creation in the Access-protected Preview CRM |
| DHF_PAYMENTS_ENABLED | false | Master payment kill switch |
| DHF_PAYMENT_PROVIDER | none | No provider selected |
| DHF_PAYMENT_METHODS | Empty | No method advertised as available |
| DHF_MANUAL_RECONCILIATION_ENABLED | false | Owner-side bank-transfer reconciliation kill switch |
| DHF_CHECKOUT_ENABLED | false | Checkout disabled |
| DHF_INVOICING_ENABLED | false | Provider invoicing disabled; DHF internal invoicing is separate |
| DHF_RECEIPT_EMAIL_ENABLED | false | Customer email kill switch |
| DHF_RECEIPT_TOKEN_SECRET | Configured as a Preview-only secret | Receipt URL signing key; never place in Git or Production |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Not configured | Email delivery unavailable |

No Stripe or Square account, key, webhook, checkout, API dependency or payment destination is used by the current application code. Stripe and Square are excluded. No third-party processor, card checkout, Apple Pay, ACH debit, hosted checkout or wallet/P2P payment is selected or authorized. A legacy Square-only flag may remain in Preview configuration as an unused compatibility setting; it does not activate a payment route. Production settings were not changed.

## Migrations

Preview has migrations 0010 through 0014 applied. Migration 0014 adds a unique partial index that prevents more than one issued/pending invoice per partnership. Earlier migration 0008 contains historical provider-named columns; they remain for schema compatibility and are not an active integration. Do not alter Production schema as part of this Preview work.

## Current behavior

- Sponsor CRM remains protected by owner-only Cloudflare Access.
- DHF invoice creation uses the signed agreement and server-side agreed amount.
- Each invoice gets a random opaque URL token; only its hash is stored.
- Resuming an open invoice rotates its URL token. The previous token stops resolving.
- Customer invoice pages are no-index, no-store and printable.
- Invoice creation does not contact a payment provider, charge a customer, send an email or mark an invoice paid.
- Direct bank-transfer instructions are unpublished until the owner verifies the receiving business account, confirms supported transfer types and fees, and approves the customer instructions.
- The permanent Payment Center QR and invoice-specific QR are generated locally in the browser and have dedicated download actions.
- Payment collection, external payment destinations, manual reconciliation, checkout and receipt email remain disabled.

## Completed Preview engineering checks

- Website CI run #490 passed 104/104 tests on commit `b35588999c3c41200dac11e83c3578de04dd1be3`. A later run against the updated Payment Center copy exposed one stale static-page assertion that expected the previously planned processor methods. The assertion was updated to enforce the owner-approved direct-transfer-only model; the updated suite still needs a fresh CI confirmation.
- Cloudflare Pages Preview deployment for the latest commit is successful: `https://e3d4867e.dahoodfarmer-website.pages.dev`.
- A real Preview D1 atomic-batch failure-injection test deliberately violated the payment receipt provider constraint. The invoice, partnership, receipt and activity writes rolled back as one unit. Temporary test records were cleaned and verified absent.
- The uploaded Carter / Columbia emblem is bundled as `/assets/dhf-carter-columbia-logo.webp` and displayed on the Payment Center, invoice, receipt and owner payment-ledger pages.

## Preview acceptance work remaining

1. Complete owner-side testing of invoice creation and secure token rotation/revocation using synthetic Preview records.
2. Complete authenticated owner-screen checks for the payment ledger and receipt display.
3. Owner verifies the receiving business bank account and its direct-transfer instructions and fees. No bank credentials or account numbers are requested in chat.
4. Complete privacy, terms, refund, tax and customer-support review before accepting customer funds.
5. Remove the synthetic Preview application, partnership and invoice after the owner confirms acceptance.

No Production release, customer email, live payment or real-money transaction is authorized by this Preview setup.
