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
| DHF_SQUARE_PAYMENT_LINKS_ENABLED | false | Square-hosted payment-link display kill switch; also requires the master payment switch |
| DHF_CHECKOUT_ENABLED | false | Checkout disabled |
| DHF_INVOICING_ENABLED | false | Provider invoicing disabled; DHF internal invoicing is separate |
| DHF_RECEIPT_EMAIL_ENABLED | false | Customer email kill switch |
| DHF_SQUARE_PAYMENT_URL | Empty | Optional official Square payment link; HTTPS square.link or checkout.square.site host only |
| 
| 
| DHF_RECEIPT_TOKEN_SECRET | Configured as a Preview-only secret | Receipt URL signing key; generated and stored in Cloudflare; never place in Git or Production |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Not configured | Email delivery unavailable |

No Stripe key, webhook secret, Stripe account, Stripe checkout or Stripe API dependency is used by the current application code. The unused STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET were also removed from the Cloudflare Pages Preview project settings; Production settings were not changed.

## Migrations

Preview has migrations 0010 through 0014 applied. Migration 0014 adds a unique partial index that prevents more than one issued/pending invoice per partnership. Earlier migration 0008 contains historical Stripe-named columns; it remains in place for schema compatibility and is not an active integration. Do not alter Production schema as part of this Preview work.

## Current behavior

- Sponsor CRM remains protected by owner-only Cloudflare Access.
- DHF invoice creation uses the signed agreement and server-side agreed amount.
- Each invoice gets a random opaque URL token; only its hash is stored.
- Resuming an open invoice rotates its URL token. The previous token stops resolving.
- Customer invoice pages are no-index, no-store and printable.
- Invoice creation does not contact a payment provider, charge a customer, send an email or mark an invoice paid.
- Apple Pay, cards, ACH and bank transfer are not activated.
- Square-hosted payment links remain hidden unless both DHF_PAYMENTS_ENABLED and DHF_SQUARE_PAYMENT_LINKS_ENABLED are explicitly true and an official allowlisted Square URL is configured. Adyen is reserved for a later per-invoice link flow. The UI validates provider hosts and renders provider QR codes locally; external payments still require owner-side settlement verification.
- The permanent Payment Center QR and invoice-specific QR are generated locally in the browser and have dedicated download actions; scan and Preview-host verification remain.
- Payment collection, external payment destinations, manual reconciliation, checkout and receipt email remain disabled.

## Preview acceptance work remaining

1. Test both QR types on actual phones, including the permanent /pay redirect and invoice-token routing.
2. Test invoice token rotation/revocation and QR refresh behavior with synthetic Preview records.
3. Test owner-only bank-transfer reconciliation, amount matching and receipt display with synthetic Preview records.
4. Owner verifies which business payment profiles actually exist and supplies only their public official payment URLs; no credentials are requested or stored.
5. Research compliant Apple Pay options without creating accounts or enabling payments.

No Production release, customer email, live payment or real-money transaction is authorized by this Preview setup.
