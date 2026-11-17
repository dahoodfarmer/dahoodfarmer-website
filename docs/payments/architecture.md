# DHF Sponsor Revenue and Invoice Checkout Architecture

**Status:** Preview implementation, payment collection disabled by default.
**Scope:** Sponsor invoices issued only after an owner-approved, signed agreement.
**Processor:** Stripe Checkout (embedded) for card/wallet collection; DHF is not a payment facilitator or processor.

## Sponsor-to-cash workflow

1. A company submits the public sponsor inquiry form.
2. The owner reviews the application in the protected Sponsor CRM.
3. The owner qualifies the prospect and records the package, agreed amount and written agreement.
4. The owner records the signed agreement link and signed date.
5. The CRM issues a one-time, high-entropy invoice link. Only the SHA-256 token hash is stored in the invoice table; the bearer token is shown in the private CRM URL.
6. The sponsor opens the invoice page and sees only the organization, invoice description, amount, due date and payment state.
7. The payment API validates the invoice token and reads the amount from D1. The browser cannot set or change the amount.
8. Stripe Checkout collects payment. DHF does not receive or store card numbers, CVC values or wallet credentials.
9. A verified Stripe webhook updates the payment ledger, invoice and sponsor CRM. Browser redirects are not proof of payment.
10. The owner reviews the payment state, deliverables and renewal date in the CRM.

## Data boundaries

- Main application `DB`: sponsor applications, CRM records, agreement references, deliverables, activities and sponsor invoices.
- Preview-only `PAYMENTS_DB`: Stripe order ledger and webhook event IDs.
- Preview-only `SESSIONS`: rate limits.
- Production databases and secrets remain untouched by this Preview implementation.

The public invoice endpoint never returns private applicant email, internal notes, agreement links or the invoice token hash. The invoice URL itself is a bearer credential and should be sent only to the contracted sponsor contact.

## Security controls

- Explicit `DHF_CHECKOUT_ENABLED=true` gate required before payment collection.
- Matching Stripe secret and publishable keys required.
- Webhook signature verified against the raw request body with a five-minute timestamp tolerance.
- Server-side amount and currency taken from the invoice record.
- Invoice tokens are high entropy and stored only as SHA-256 hashes.
- Same-origin checks, allowed-host checks, rate limits and D1 order persistence.
- Duplicate webhook events are recorded with a unique event ID; invoice/partnership state updates are idempotent.
- Checkout session is expired if the order cannot be persisted.
- Owner-only Cloudflare Access protects the Sponsor CRM and admin API.

## Scope intentionally not enabled

- No self-service sponsor package checkout.
- No public product or ticket catalog checkout.
- No automatic contract generation or electronic signature.
- No live-mode payment acceptance.
- No production payment database or production webhook.
- No refunds or recurring sponsor subscriptions.
- No payment-provider replacement or integration with FLO Business Solutions.

## Launch gates

Before a live launch, the owner must complete and approve:
- Stripe account verification and payout bank setup.
- A matching test-mode publishable key and successful test checkout in Preview.
- A webhook endpoint and signing secret configured for the exact environment.
- Customer-facing terms, refund/cancellation policy, privacy and invoice support process.
- End-to-end testing of successful, expired, failed, duplicate-webhook and retry flows.
- A separately provisioned production payment database and production secrets.
- Explicit written approval to enable Production checkout.

Until then, keep `DHF_CHECKOUT_ENABLED=false`.
