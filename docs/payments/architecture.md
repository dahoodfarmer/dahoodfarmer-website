# Da HoodFarmer Payment Center — Architecture

**Status:** DHF-owned invoice foundation in Preview; payment collection remains disabled.
**Product decision:** DHF owns the customer experience and business records. No Stripe integration or Stripe account is part of this product.

## DHF-owned capabilities

DHF owns the branded Payment Center, sponsor CRM, signed-agreement records, invoice numbering, invoice amounts, secure invoice URLs, QR destinations, payment status, receipts, reporting and reconciliation workflow. The invoice amount is read from the server-side agreed amount on a signed agreement; it is never accepted from the browser.

The current Preview implementation issues a DHF invoice independently of any payment provider. The permanent Payment Center QR opens the stable /pay route; invoice pages generate a separate QR for their own opaque invoice URL. Each invoice receives a random opaque URL token; only its SHA-256 hash is stored. Reissuing the same open invoice rotates its token, making the prior URL unusable. Invoice pages are private/no-index, printable, and display current invoice status. No card or bank credentials are collected.

## Two QR destinations

1. **Permanent Payment Center QR:** a stable DHF-owned destination that opens the branded Payment Center.
2. **Invoice QR:** a unique QR for each invoice, containing only its opaque DHF invoice URL. It resolves to the current invoice amount and status.

A QR is a visual link, not a payment network. Do not encode personal data, bank details, invoice amounts, or credentials in QR payloads. QR codes are generated locally in the browser using a vendored MIT-licensed QR library; no external QR image service receives invoice URLs.

## Payment methods and settlement

- **External business payment destinations:** the Payment Center and invoice pages can display owner-configured PayPal business, Venmo business-profile, and Cash App Business links. The server allowlists only official Square payment-link hosts and rejects lookalike domains, credentials and nonstandard ports. The displayed destination gets a local QR code; invoice instructions tell the customer to enter the exact amount and invoice number if the configured Square link is a variable-amount collection link. These are provider-hosted payments, not DHF checkout, and are never marked paid automatically. No destination is active until the owner supplies and verifies the official Square link in Preview configuration. Adyen remains a future invoice-specific hosted-link integration because Adyen payment links are amount-specific and expire.
- **Apple Pay and cards:** remain inactive until DHF completes Apple merchant setup and chooses a compliant, authorized acquiring/processing and settlement route.
- **ACH:** remains inactive until authorization, return handling and settlement requirements are verified.
- **Bank transfer:** may be supported as an owner-approved manual method. A screenshot, remittance advice or customer statement is not proof of settlement. Only the owner can reconcile cleared funds in the business bank account and mark an invoice paid.
- DHF must not represent itself as a card processor or payment facilitator, and must not collect card numbers, CVV/security codes or bank login credentials.

No external business destination is configured. Payment collection and DHF checkout remain disabled. The external-destination framework is dormant until an owner-verified business profile URL is configured. Manual settlement support must remain fail-closed until its separate owner reconciliation workflow is complete.

## Security and operating rules

- Internal invoice issuance is enabled only in the isolated Preview environment behind owner-only Cloudflare Access.
- Payment collection, checkout and receipt email remain disabled.
- Invoice tokens are random, opaque, hash-only at rest, no-index and revocable by token rotation.
- Invoice creation requires a signed agreement, contracted/fulfilling stage, agreed server-side amount, valid billing email and future due date.
- A browser redirect, screenshot or payment promise never marks an invoice paid. External provider payments require owner verification in the provider activity before reconciliation.
- No customer email is sent automatically.
- No production database, secret, DNS, deployment, or payment activation is part of this work.

## Legacy database compatibility

Earlier additive migrations introduced legacy provider columns and constraints. They remain in the schema for migration compatibility only; the current application code has no Stripe adapter, Stripe API call, Stripe webhook, or Stripe health-check route. Do not add a provider dependency without a new owner-approved decision.
