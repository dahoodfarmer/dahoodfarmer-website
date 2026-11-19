# Da HoodFarmer Payment Center — DHF-Owned Architecture

**Status:** Preview development foundation. DHF-owned invoices are provider-independent; payment collection remains disabled.

## Owner-approved decision

DHF owns invoices, QR destinations, customer experience, records and reconciliation. Stripe and Square are excluded. No third-party payment processor, hosted checkout, card checkout, Apple Pay, ACH debit or wallet checkout is selected or authorized. The only payment route under consideration is a direct bank-to-bank transfer to a verified DHF business account.

## DHF ownership

DHF owns the branded Payment Center, sponsor CRM, signed agreements, invoice numbering, invoice records, secure invoice links, QR destinations, payment status, receipts, reporting and customer relationship. Invoice amounts come from the signed agreement stored in the server-side CRM.

## Direct bank transfer and reconciliation

- Direct bank transfer is not active yet. DHF will publish business bank-transfer instructions only after the owner verifies the receiving business account, confirms supported incoming transfer types, settlement timing and fees, and approves the wording.
- The receiving bank may charge account, wire or other transfer fees. Confirm exact terms directly with the bank.
- A customer screenshot, remittance advice or payment promise is not proof of settlement.
- Only the owner may manually reconcile an invoice after independently verifying cleared funds in the DHF business bank account and confirming the exact invoice amount.
- All payment switches remain off. No customer is instructed to send money.

## QR experiences

- Permanent DHF Payment Center QR: stable branded entry point.
- Invoice-specific QR: unique opaque invoice URL that resolves to the live invoice amount and status.
- QR payloads contain only DHF URLs. No personal information, amount, bank details or credentials. QR codes are generated locally; do not use a third-party QR image service.

## Current Preview implementation

The private Sponsor CRM can create a DHF-owned invoice only from a signed agreement, contracted stage, agreed amount, valid billing email and future due date. The server generates a random 256-bit URL token, stores only its SHA-256 hash, and rotates the token when an open invoice is resumed. Customer invoice pages are no-index, no-store and printable. The invoice amount cannot be changed by the customer.

DHF_INTERNAL_INVOICING_ENABLED is enabled only in the isolated Preview configuration. DHF_PAYMENTS_ENABLED, DHF_CHECKOUT_ENABLED and receipt email remain false. No payment provider is configured. Direct bank instructions and reconciliation remain disabled pending owner-side bank setup and approval.

## Legacy schema

Some historical migrations retain provider-specific database columns and CHECK values for compatibility with databases already migrated. Those legacy columns are not used by the current application code. No active Stripe, Square, Adyen or other processor adapter, API, webhook or checkout route is included in this release branch.

## Activation gates

1. Verify the receiving business bank account and the account's eligibility for commercial receipts.
2. Obtain the bank's details for supported incoming transfer types, settlement times, limits, reversals and fees.
3. Add only owner-approved business bank instructions to customer invoices; never expose login credentials or personal account access.
4. Complete owner acceptance of invoice creation, token rotation/revocation, QR scan behavior and owner ledger/receipt display in Preview with synthetic records.
5. Complete privacy, terms, refund, tax and customer-support review.
6. Obtain explicit owner approval before publishing bank instructions, enabling reconciliation, changing Production or accepting customer funds.
