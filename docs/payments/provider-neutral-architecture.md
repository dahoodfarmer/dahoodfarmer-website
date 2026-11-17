# Da HoodFarmer Payment Center — Provider-Neutral Architecture

**Status:** Development foundation only. Payment collection remains disabled.
**Architecture decision:** Level 2 is the DHF-owned payment experience; Level 1 is the regulated payment provider/acquirer underneath it.

## Ownership boundary

DHF owns the branded payment center, sponsor CRM, approved package pricing, signed agreements, invoice records, payment links, QR destinations, receipts, reporting, reconciliation workflow and customer relationship. An authorized processor/acquirer performs card and wallet processing, bank debits, settlement, fraud controls and card-network/chargeback obligations.

DHF does not store primary account numbers, CVV/security codes, bank login credentials or raw payment credentials. Payment credentials must be collected by a provider-hosted or properly scoped PCI-compliant checkout.

## Payment methods

- Apple Pay: enabled only through a provider/acquirer that supports the merchant's verified domain and merchant account.
- Debit/credit cards: enabled only through the selected provider's hosted checkout.
- ACH: enabled only after the provider confirms support, mandate/authorization requirements, return handling and settlement timing.
- Bank transfer/wire: may be offered as an owner-approved offline method. A screenshot, remittance advice or customer statement is not proof of settlement; the owner must verify funds in the business bank account before marking paid.

The public Payment Center currently displays the three intended methods as **not activated**. It does not accept payment details or create a payment session.

## Provider adapter contract

The payment-provider module supplies a fail-closed configuration resolver. Provider adapters must implement createInvoice, retrieveInvoice and verifyWebhook; provider-specific code remains isolated behind that contract. No provider is selected by default. A provider is considered configured only when DHF_PAYMENTS_ENABLED=true and a recognized DHF_PAYMENT_PROVIDER value is supplied. The public-safe configuration contains no secret values.

The first adapter candidate is Stripe because it has an existing draft implementation. FLO Business Solutions remains a candidate, not an integrated provider: no API, acquiring bank, gateway, webhook format, pricing or settlement arrangement has been verified. Do not invent FLO endpoints or credentials. A FLO adapter requires its written technical documentation and commercial terms.

## Activation gates

1. Verify the correct legal merchant identity, tax classification, business address and payout bank account with the selected provider.
2. Obtain written processing rates, monthly/minimum fees, reserves, payout schedule, chargeback/refund fees, contract term and termination conditions.
3. Verify support for Apple Pay, cards and ACH separately; do not infer availability from marketing material.
4. Configure Preview-only test credentials and webhook secrets; verify test/live mode server-side.
5. Test successful, declined, expired, duplicate, delayed, refunded and disputed payment paths.
6. Confirm invoice amount/currency against the signed agreement and provider event; never trust browser-submitted amounts.
7. Reconcile ACH returns and manual bank transfers; do not fulfill benefits on pending status.
8. Complete privacy, terms, tax, refund and customer-support review.
9. Obtain explicit owner approval before any live account, production secret, migration or payment activation.

## QR codes

A QR code is only a visual encoding of an opaque DHF payment URL. It is not a payment processor. Generate one unique QR per invoice only after a secure invoice URL exists. The QR must not contain sponsor personal data, bank details, invoice amount, secret tokens or payment credentials. The QR destination must be revocable and must resolve to the current invoice/payment state. No third-party QR image service is used by the current page.

## Data model

Migration 0010_provider_neutral_payments.sql adds provider IDs, provider invoice references, provider status, payment method and an idempotent provider-event ledger. Existing Stripe-specific columns remain temporarily for backward compatibility; new integrations must use provider-neutral columns. Do not apply the migration to Production as part of Preview work.

## Operational rules

- All payment flags default to false; no fallback provider is selected.
- Invoice creation still requires a signed agreement, contracted stage, agreed server-side amount, valid billing contact and due date.
- Payment status is system-managed. Only a verified provider event or owner-verified bank settlement can mark an invoice paid.
- No self-service donation/custom-amount page, recurring billing, payment facilitation for third parties, or split payouts are included.
- DHF may set its own sponsorship package prices and commercial terms. Any processing surcharge must be separately reviewed for applicable law, card-network rules and disclosure requirements; default to pricing fees into the package.
- Do not claim DHF is a payment processor or payment facilitator.

## Current phase exclusions

No live payments, provider account creation, bank account changes, external sponsor communications, paid service activation, Production schema/secret/DNS changes, or Production deployment.
