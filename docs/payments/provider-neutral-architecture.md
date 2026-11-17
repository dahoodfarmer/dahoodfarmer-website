# Da HoodFarmer Payment Center — Provider-Neutral Architecture

**Status:** Preview development foundation. DHF-owned invoices are provider-independent; payment collection remains disabled.
**Decision:** The DHF platform owns invoices, QR destinations, customer experience, records and reconciliation. No Stripe integration or account is intended.

## DHF ownership

DHF owns the branded Payment Center, sponsor CRM, signed agreements, invoice numbering, invoice records, secure invoice links, QR destinations, payment status, receipts, reporting and customer relationship. Invoice amounts come from the signed agreement stored in the server-side CRM.

## Payment rails are separate

- Apple Pay and card acceptance require merchant setup and an authorized acquiring/processing and settlement route. A QR code does not itself process or settle money.
- ACH requires confirmed authorization, return-handling and settlement procedures.
- Manual bank transfer can be reconciled only after the owner independently verifies cleared funds in the business bank account.
- DHF does not store card numbers, CVV/security codes, bank login credentials or raw payment credentials.

The public Payment Center shows intended methods as not activated. No payment form or live checkout is available.

## Two QR experiences

- Permanent DHF Payment Center QR: stable branded entry point.
- Invoice-specific QR: unique opaque invoice URL that resolves to the live invoice amount and status.

QR payloads contain only DHF URLs. No personal information, amount, bank details or credentials. Do not use a third-party QR image service.

## Current Preview implementation

The private Sponsor CRM can create a DHF-owned invoice only from a signed agreement, contracted stage, agreed amount, valid billing email and future due date. The server generates a random 256-bit URL token, stores only its SHA-256 hash, and rotates the token when an open invoice is resumed. Customer invoice pages are no-index, no-store and printable. The invoice amount cannot be changed by the customer.

DHF_INTERNAL_INVOICING_ENABLED is enabled only in the isolated Preview configuration. DHF_PAYMENTS_ENABLED, DHF_CHECKOUT_ENABLED and receipt email remain false. No payment provider is selected.

## Legacy schema

Some historical migrations retain provider-specific database columns and CHECK values for compatibility with databases already migrated. Those legacy columns are not used by the current application code. The Stripe adapter, API health endpoint, webhook route and Stripe-specific tests are removed from this branch.

## Activation gates

1. Verify legal merchant identity, tax classification, business address and payout account.
2. Compare written commercial terms and payout/settlement conditions for any candidate acquiring route.
3. Verify Apple Pay domain, merchant ID, certificates and provider/acquirer support before advertising it as available.
4. Test invoice creation, token rotation/revocation, QR scan behavior and owner reconciliation in Preview.
5. Verify ACH authorization, returns and settlement before any activation.
6. Complete privacy, terms, refund, tax and customer-support review.
7. Obtain explicit owner approval before live account setup, Production secrets, migrations, DNS changes, deployment or payment activation.
