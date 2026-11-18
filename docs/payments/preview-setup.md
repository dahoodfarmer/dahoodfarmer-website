# DHF Payment Center — Preview Setup

**Environment:** Cloudflare Pages Preview only.  
**Production:** No production database, secret, DNS, deployment or payment activation changes.

## Isolated Preview resources

| Binding | Resource | ID |
|---|---|---|
| DB | dahoodfarmer-preview-db | ca5786b1-751e-4cee-b595-3a4b60061cc9 |
| SESSIONS | dahoodfarmer-preview-sessions | 2218d0643bab47e0b1bd46fd0e473637 |

The production branch remains site-rebuild-v2. Payment work is on feature/dhf-provider-neutral-payment-center.

## Preview controls

| Variable | Preview setting | Purpose |
|---|---|---|
| DHF_INTERNAL_INVOICING_ENABLED | true | Allow DHF-owned invoice creation in the Access-protected Preview CRM |
| DHF_PAYMENTS_ENABLED | false | Master payment kill switch |
| DHF_PAYMENT_PROVIDER | none | No provider selected |
| DHF_PAYMENT_METHODS | Empty | No method advertised as available |
| DHF_MANUAL_RECONCILIATION_ENABLED | false | Owner-side bank-transfer reconciliation kill switch |
| DHF_CHECKOUT_ENABLED | false | Third-party checkout disabled |
| DHF_INVOICING_ENABLED | false | Provider invoicing disabled; DHF internal invoicing is separate |
| DHF_RECEIPT_EMAIL_ENABLED | false | Customer email kill switch |
| DHF_RECEIPT_TOKEN_SECRET | Configured as a Preview-only secret | Receipt URL signing key; generated and stored in Cloudflare; never place in Git or Production |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Not configured | Email delivery unavailable |

No Stripe or Square account, key, webhook, checkout, API dependency or payment destination is used by the current application code. Any stale Square-only Preview environment variables are unused and should be removed from Preview configuration. Production settings were not changed.

## Migrations

Preview has migrations 0010 through 0014 applied. Migration 0014 adds a unique partial index that prevents more than one issued/pending invoice per partnership. Earlier migration 0008 contains historical provider-named columns; it remains in place for schema compatibility and is not an active integration. Do not alter Production schema as part of this Preview work.

## Current behavior

- Sponsor CRM remains protected by owner-only Cloudflare Access.
- DHF invoice creation uses the signed agreement and server-side agreed amount.
- Each invoice gets a random opaque URL token; only its hash is stored.
- Resuming an open invoice rotates its URL token. The previous token stops resolving.
- Customer invoice pages are no-index, no-store and printable.
- Invoice creation does not contact a payment provider, charge a customer, send an email or mark an invoice paid.
- Card, Apple Pay, ACH debit, bank-transfer instructions and receipt email are not activated.
- No third-party processor or hosted checkout is integrated. Direct bank-transfer instructions remain unpublished until the owner verifies the business settlement account, confirms the bank's transfer method and fees, and approves the customer instructions. The customer UI remains fail-closed.
- The permanent Payment Center QR and invoice-specific QR are generated locally in the browser and have dedicated download actions. Both QR types were physically scanned successfully on the owner's devices after Cloudflare Access sign-in.
- Payment collection, external payment destinations, manual reconciliation, checkout and receipt email remain disabled.

## Preview acceptance work remaining

1. Complete owner-side testing of invoice creation and secure token rotation/revocation using synthetic Preview records.
2. Complete owner-side manual bank-transfer reconciliation, exact-amount matching and receipt display using synthetic Preview records; keep all switches off until separately approved.
3. Owner verifies the receiving business bank account and its direct-transfer instructions and fees. No bank credentials are requested or stored.
4. Complete privacy, terms, refund, tax and customer-support review before accepting customer funds.

No Production release, customer email, live payment or real-money transaction is authorized by this Preview setup.
