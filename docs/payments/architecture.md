# Da HoodFarmer Payment Center — Architecture

**Status:** Provider-neutral Preview foundation; payment collection is disabled.
**Decision:** Level 2 is the DHF-owned payment experience, with Level 1 authorized processing infrastructure underneath it.

## Owner-controlled process

1. A company submits the public sponsor inquiry form.
2. The owner reviews the inquiry in the Cloudflare Access-protected Sponsor CRM.
3. The owner qualifies the prospect, records the package and agreed amount, and stores the signed agreement link and date.
4. The owner selects a future due date and issues an invoice only after the payment provider has been verified and explicitly enabled.
5. The backend creates or resumes a provider invoice using a server-side amount from the signed agreement. The owner reviews and shares the payment link; DHF does not automatically email invoices.
6. The sponsor pays through the provider's secure hosted checkout. DHF does not collect or store card numbers, security codes or bank login credentials.
7. A signed provider webhook or owner-verified bank settlement updates payment status. A browser redirect, screenshot or remittance advice is never treated as proof of payment.
8. The owner tracks deliverables, evidence, payment status and renewal dates in the Sponsor CRM.

## Level 2 — DHF-owned platform

DHF owns the branded payment center, sponsor CRM, package pricing, invoices, payment-link routing, QR destinations, a durable receipt ledger, reconciliation workflow, reporting and sponsor relationship. A verified paid invoice creates one receipt record keyed uniquely to the invoice. The customer receives an unguessable, no-index receipt page that can be printed or saved as PDF; the owner receives the matching record in the private Payment & Receipt Ledger. The current public Payment Center is an informational foundation only. It displays Apple Pay, cards and ACH/bank transfer as not activated and has no payment form or live checkout.

## Level 1 — Authorized provider

An authorized payment provider/acquirer performs card and wallet processing, bank debits, settlement, fraud controls and card-network/chargeback obligations. DHF does not store primary account numbers, CVV/security codes, bank credentials or raw payment credentials.

The payment-provider module supplies a fail-closed resolver and a Stripe invoice adapter behind a provider contract. Invoice creation and webhook handling require an explicitly selected Stripe provider and DHF_PAYMENTS_ENABLED=true. No provider is selected by default. The existing Stripe adapter is retained as the first candidate, not as a permanent lock-in.

FLO Business Solutions remains a candidate, not an integrated provider. Its acquiring bank, gateway/API, webhook format, rates, ACH/Apple Pay support and settlement arrangements have not been verified. Do not invent endpoints or credentials. A FLO adapter requires written technical documentation and commercial terms.

## Payment methods

- Apple Pay: only through a provider/acquirer supporting the merchant's verified domain and account.
- Debit/credit cards: through the selected provider's hosted checkout.
- ACH: only after provider support, authorization requirements, return handling and settlement timing are verified.
- Bank transfer/wire: may be offered as an owner-approved offline method. The owner must verify cleared funds in the business bank account before marking an invoice paid.

## Provider configuration and launch gates

All flags default to false. Preview currently sets DHF_PAYMENTS_ENABLED=false, DHF_PAYMENT_PROVIDER=none, DHF_PAYMENT_METHODS empty, DHF_INVOICING_ENABLED=false and DHF_CHECKOUT_ENABLED=false.

Before activation, the owner must approve:
- Correct legal merchant identity, tax classification, business address and payout bank account.
- Written processing rates, monthly/minimum fees, reserves, payout schedule, chargeback/refund fees, contract term and termination conditions.
- Separate confirmation of Apple Pay, card and ACH support.
- Preview-only test credentials, signed webhook configuration and server-side test/live-mode verification.
- Successful, declined, expired, duplicate, delayed, refunded and disputed payment tests.
- Invoice amount/currency matching against the signed agreement and provider event.
- ACH return handling, bank-transfer reconciliation, privacy, terms, tax and refund policy review.
- Explicit owner approval before any live account, Production secret, migration, deployment or payment activation.

## QR codes

A QR code is only a visual encoding of an opaque DHF payment URL; it is not a processor. Generate a unique QR only after a secure invoice URL exists. It must not contain sponsor personal data, bank details, amount, secret tokens or payment credentials. The destination must be revocable and resolve to current invoice/payment state. No external QR image service is used in the current foundation.

## Data boundaries

- Main D1 DB: sponsor applications, CRM partnerships, agreements, deliverables, activities and invoice/provider references.
- SESSIONS: application and admin rate limiting.
- Migration 0010 adds provider-neutral identifiers and an idempotent provider-event ledger; migration 0011 adds the provider-neutral customer reference; migration 0012 adds the durable receipt ledger. Existing Stripe-specific fields remain temporarily for compatibility.
- Production databases, secrets, DNS and deployments remain untouched.

## Explicit exclusions

No live-mode charges, automatic invoice emails or receipt emails, recurring billing, public marketplace checkout, custom-amount donations, payment facilitation for third parties, split payouts, provider account creation or bank account changes. Receipt email delivery remains a separate activation step; no customer email is sent until an approved sender is configured and owner-authorized. DHF may set sponsorship package prices and commercial terms. Any processing surcharge requires separate legal and card-network review; the default is to price processing costs into the package. Do not represent DHF as a payment processor or payment facilitator.
