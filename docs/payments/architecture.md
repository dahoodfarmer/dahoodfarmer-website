# Da HoodFarmer Payment Center — Architecture

**Status:** DHF-owned invoice foundation in Preview; payment collection remains disabled.
**Product decision:** DHF owns the customer experience and business records. Stripe and Square are excluded. No third-party hosted checkout is part of the initial launch.

## DHF-owned capabilities

DHF owns the branded Payment Center, sponsor CRM, signed-agreement records, invoice numbering, invoice amounts, secure invoice URLs, QR destinations, payment status, receipts, reporting and reconciliation workflow. Invoice amounts are read from the server-side agreed amount on a signed agreement; they are never accepted from the browser.

The current Preview implementation issues DHF invoices independently of any payment provider. The permanent Payment Center QR opens the stable /pay route; invoice pages generate a separate QR for their own opaque invoice URL. Each invoice receives a random opaque URL token; only its SHA-256 hash is stored. Reissuing the same open invoice rotates its token, making the prior URL unusable. Invoice pages are private/no-index, printable and display current invoice status. No card or bank credentials are collected.

## Two QR destinations

1. **Permanent Payment Center QR:** a stable DHF-owned destination that opens the branded Payment Center.
2. **Invoice QR:** a unique QR for each invoice, containing only its opaque DHF invoice URL. It resolves to the current invoice amount and status.

A QR is a visual link, not a payment network. Do not encode personal data, bank details, invoice amounts or credentials in QR payloads. QR codes are generated locally in the browser using a vendored MIT-licensed QR library; no external QR image service receives invoice URLs.

## Payment methods and settlement

- **Direct bank transfer:** the intended first payment rail. DHF will provide business bank-transfer instructions directly on the invoice only after the owner verifies the receiving business account, confirms the bank's transfer options and any fees, and approves the wording. A customer screenshot, remittance advice or payment promise is not proof of settlement.
- **Manual reconciliation:** only the owner may mark an invoice paid, and only after independently verifying cleared funds in the DHF business bank account and confirming the exact invoice amount. The reconciliation endpoint is fail-closed behind the master payment switch, manual-reconciliation switch, manual provider selection and bank-transfer method. All remain off in Preview.
- **Cards, Apple Pay, ACH debit and third-party wallet checkout:** excluded from the initial launch. A DHF-owned screen or QR does not remove card-network, acquiring or processing costs. Do not add a processor or payment facilitator without a separate owner-approved business case.
- DHF must not represent itself as a card processor or payment facilitator, and must not collect card numbers, CVV/security codes or bank login credentials.

No bank account details or payment destination are currently published. Payment collection and DHF checkout remain disabled. No customer is instructed to send money. Direct bank transfers can avoid card-processing percentages, but the receiving bank may charge account, wire or other transfer fees; confirm the exact terms with the bank before activation.

## Security and operating rules

- Internal invoice issuance is enabled only in the isolated Preview environment behind owner-only Cloudflare Access.
- Payment collection, checkout and receipt email remain disabled.
- Invoice tokens are random, opaque, hash-only at rest, no-index and revocable by token rotation.
- Invoice creation requires a signed agreement, contracted/fulfilling stage, agreed server-side amount, valid billing email and future due date. A Preview migration adds a unique partial index so each partnership can have only one issued/pending invoice at a time; concurrent duplicate issuance is rejected safely.
- A browser redirect, screenshot or payment promise never marks an invoice paid.
- No customer email is sent automatically.
- No production database, secret, DNS, deployment or payment activation is part of this work.

## Legacy database compatibility

Earlier additive migrations introduced legacy provider columns and constraints. They remain in the schema for migration compatibility only; the current application code has no active third-party processor adapter, API call, webhook or health-check route. Do not add a provider dependency without a new owner-approved decision.
