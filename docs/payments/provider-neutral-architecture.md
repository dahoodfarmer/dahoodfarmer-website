# Da HoodFarmer Payment Center — DHF-Owned Architecture

**Status:** Preview development foundation. DHF-owned invoices are provider-independent; payment collection remains disabled.
**Decision:** DHF owns invoices, QR destinations, customer experience, records and reconciliation. Stripe is permanently excluded. Direct bank transfer remains a separate first-party route. Square Web Payments SDK is the preferred non-Stripe candidate for embedded Apple Pay/card/ACH, but is not selected, integrated or activated. No third-party hosted checkout is part of the initial launch.

## DHF ownership

DHF owns the branded Payment Center, sponsor CRM, signed agreements, invoice numbering, invoice records, secure invoice links, QR destinations, payment status, receipts, reporting and customer relationship. Invoice amounts come from the signed agreement stored in the server-side CRM.

## Payment rails are separate

- Direct bank-to-bank transfer is the intended first payment rail. It can avoid card-processing percentages, but the receiving bank may charge account, wire or other transfer fees. The owner must confirm the exact terms with the bank.
- Manual bank transfer can be reconciled only after the owner independently verifies cleared funds in the DHF business bank account and confirms the exact invoice amount.
- Apple Pay and card payments remain planned but inactive. Square Web Payments SDK is the leading candidate because it supports an embedded DHF checkout interface, but it requires Square merchant setup and card-processing fees.
- Square ACH is a separate, optional rail. It is asynchronous and settles first to the Square seller balance before payout to DHF's linked bank; it is not a direct buyer-to-DHF-bank transfer.
- A DHF-owned interface does not eliminate card-network or acquiring costs. See `non-stripe-processor-evaluation.md` for the comparison and fee details.
- DHF does not store card numbers, CVV/security codes, bank login credentials or raw payment credentials.

The public Payment Center shows methods as not activated. No payment form, checkout or bank details are published.

## Two QR experiences

- Permanent DHF Payment Center QR: stable branded entry point.
- Invoice-specific QR: unique opaque invoice URL that resolves to the live invoice amount and status.

QR payloads contain only DHF URLs. No personal information, amount, bank details or credentials. Do not use a third-party QR image service.

## Current Preview implementation

The private Sponsor CRM can create a DHF-owned invoice only from a signed agreement, contracted stage, agreed amount, valid billing email and future due date. The server generates a random 256-bit URL token, stores only its SHA-256 hash, and rotates the token when an open invoice is resumed. Customer invoice pages are no-index, no-store and printable. The invoice amount cannot be changed by the customer.

DHF_INTERNAL_INVOICING_ENABLED is enabled only in the isolated Preview configuration. DHF_PAYMENTS_ENABLED, DHF_CHECKOUT_ENABLED and receipt email remain false. No payment provider is configured. Direct bank instructions and reconciliation remain disabled pending owner-side bank setup and approval. Square is an evaluation candidate only; no account, credentials, SDK or webhook integration has been created.

## Legacy schema

Some historical migrations retain provider-specific database columns and CHECK values for compatibility with databases already migrated. Those legacy columns are not used by the current application code. No active Stripe, Square, Adyen or other processor adapter, API, webhook or checkout route is included in this release branch.

## Activation gates

1. Verify legal merchant identity, tax classification, business address and the receiving business bank account.
2. Obtain the bank's written details for supported incoming transfer types, processing times and any fees.
3. Add only approved business bank instructions to customer invoices; never expose login credentials or personal account access.
4. Test invoice creation, token rotation/revocation, QR scan behavior and owner reconciliation in Preview with synthetic records.
5. Complete privacy, terms, refund, tax and customer-support review.
6. Obtain explicit owner approval before publishing bank instructions, enabling reconciliation, changing Production or accepting customer funds.
