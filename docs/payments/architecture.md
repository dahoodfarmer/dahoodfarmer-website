# Da HoodFarmer Payment Center — Architecture

**Status:** DHF-owned invoice foundation in Preview; payment collection remains disabled.

## Owner-approved payment model

- Stripe is permanently excluded.
- Square is excluded.
- No third-party payment processor, hosted checkout, card checkout, Apple Pay, ACH debit or wallet checkout is selected or authorized.
- The only payment route under consideration is a direct bank-to-bank transfer to a verified DHF business account.
- The DHF Payment Center, invoice pages, QR codes, invoice numbers, payment status, receipts, reporting and reconciliation remain first-party DHF functions.
- No bank account details or payment destination are published. No customer is instructed to send money.
- The receiving bank may charge account, wire or other transfer fees. Confirm exact terms with the bank before publishing instructions.

## DHF-owned capabilities

DHF owns the branded Payment Center, sponsor CRM, signed-agreement records, invoice numbering, invoice amounts, secure invoice URLs, QR destinations, payment status, receipts, reporting and reconciliation workflow. Invoice amounts are read from the server-side agreed amount on a signed agreement; they are never accepted from the browser.

The current Preview implementation issues DHF invoices independently of any payment provider. The permanent Payment Center QR opens the stable `/pay` route; invoice pages generate a separate QR for their own opaque invoice URL. Each invoice receives a random opaque URL token; only its SHA-256 hash is stored. Reissuing the same open invoice rotates its token, making the prior URL unusable. Invoice pages are private/no-index, printable and display current invoice status. No card or bank credentials are collected.

## Two QR destinations

1. **Permanent Payment Center QR:** a stable DHF-owned destination that opens the branded Payment Center.
2. **Invoice QR:** a unique QR for each invoice, containing only its opaque DHF invoice URL.

A QR is a visual link, not a payment network. Do not encode personal data, bank details, invoice amounts or credentials in QR payloads. QR codes are generated locally in the browser using a vendored MIT-licensed QR library; no external QR image service receives invoice URLs.

## Direct bank transfer and settlement

- Direct bank transfer is the only payment route under consideration. DHF will provide business bank-transfer instructions directly on the invoice only after the owner verifies the receiving business account, confirms supported incoming transfer types, settlement timing and any fees, and approves the wording.
- A customer screenshot, remittance advice or payment promise is not proof of settlement.
- Only the owner may manually mark an invoice paid, and only after independently verifying cleared funds in the DHF business bank account and confirming the exact invoice amount.
- Manual reconciliation is fail-closed behind the master payment switch, manual-reconciliation switch, manual provider selection and bank-transfer method. All remain off in Preview.
- Receipts are generated only after confirmed reconciliation. Receipt email remains disabled.

## Security and operating rules

- Internal invoice issuance is enabled only in the isolated Preview environment behind owner-only Cloudflare Access.
- Payment collection, checkout, payment instructions and receipt email remain disabled.
- Invoice tokens are random, opaque, hash-only at rest, no-index and revocable by token rotation.
- Invoice creation requires a signed agreement, contracted/fulfilling stage, agreed server-side amount, valid billing email and future due date. A Preview migration adds a unique partial index so each partnership can have only one issued/pending invoice at a time; concurrent duplicate issuance is rejected safely.
- A browser redirect, screenshot or payment promise never marks an invoice paid.
- No customer email is sent automatically.
- No production database, secret, DNS, deployment or payment activation is part of this work.

## Legacy database compatibility

Earlier additive migrations introduced legacy provider columns and constraints. They remain in the schema for migration compatibility only and are not an active processor integration. The former Stripe checkout and webhook API routes have been removed from this feature branch; the current application code has no active third-party processor adapter, API call, webhook or health-check route. The shop page is informational and has no checkout. Do not add provider credentials or third-party checkout code without a new explicit owner decision.
