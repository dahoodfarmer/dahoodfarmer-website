# DHF Payment Engine — Architecture & Delivery Plan

**Project:** DaHoodFarmer.com only  
**Status:** Foundation plan; implementation begins in test mode  
**Production branch:** `site-rebuild-v2` (this feature branch is isolated)  
**Principle:** Own the checkout software and customer experience; use a regulated processor for card authorization and bank settlement.

## Product boundary

This is a first-party payment experience embedded in DaHoodFarmer.com. It is not a public payment facilitator, marketplace, or separate payment-company launch. Do not represent DHF as the card network, acquiring bank, or processor.

## Initial customer experience

- Branded payment entry point and QR landing page using approved Da HoodFarmer logo assets.
- Mobile-first embedded checkout.
- Initial MVP: one-time support contributions with a customer-entered amount. Product, service, and invoice payments remain disabled until trusted server-side catalog/invoice pricing is implemented.
- Card payments plus Apple Pay / Google Pay when the device, browser, domain verification, and processor configuration support them.
- Clear pending, successful, failed, and cancelled states.
- Customer receipt and merchant notification after verified payment confirmation.

## Architecture

1. **Website UI:** first-party pages/components served by Cloudflare Pages.
2. **DHF Payment API:** Cloudflare Pages Functions; validates server-side amount, currency, item/order reference, and idempotency.
3. **Order ledger:** Cloudflare D1 stores internal orders and payment state. Never store PAN, CVC, wallet cryptograms, or raw card data.
4. **Processor adapter:** isolated server-side adapter; Stripe Checkout Sessions with embedded UI is the initial integration recommendation. Keep provider-specific code behind an interface so a future provider can be added without rewriting the order system.
5. **Webhook handler:** verify provider signatures, deduplicate event IDs, reconcile final status, and update D1. Browser redirects are not proof of payment.
6. **Merchant view:** authenticated dashboard for order/payment status, transaction history, and later refunds/reconciliation.
7. **QR:** QR codes point to first-party DHF URLs with opaque order/payment references. Never put secrets or card data in a QR code.

## Security and operational requirements

- Begin in Stripe test mode only. Do not create live charges or enable production payment acceptance until the owner completes account onboarding, payout bank setup, business details, and explicitly approves a live launch.
- API secrets live only in Cloudflare Pages encrypted production/preview secrets; never in Git, browser code, logs, or chat.
- Verify webhook signatures against the raw request body; enforce idempotency and replay protection.
- Calculate all prices and totals on the server from trusted product/order records. Never trust a browser-supplied amount.
- Apply rate limits, request validation, origin/CSRF protections as appropriate, and structured redacted logs.
- Preserve existing contact form, Turnstile, analytics, AdSense, and DNS configuration.
- Use least privilege for admin access; do not expose payment records publicly.
- Test success, decline, cancellation, duplicate webhook, delayed webhook, QR tampering, amount tampering, and mobile wallet availability before launch.

## Delivery phases

### Phase 0 — Foundation
- Confirm existing Cloudflare Pages/D1 bindings and repository conventions.
- Confirm Stripe account access and test-mode readiness.
- Define D1 schema, API contracts, and provider adapter boundary.
- Identify approved Da HoodFarmer logo asset and brand colors.

### Phase 1 — Test-mode MVP
- Use a dedicated preview-only D1 database (`dahoodfarmer-payments-test`); do not point preview payment writes at the production database.
- Initial checkout purpose is support contributions only; never accept customer-entered totals for product/service/invoice purchases.
- Create payment/order records.
- Embedded checkout and branded payment page.
- QR landing route for a payment/order reference.
- Signed webhook processing and receipt/status page.
- Minimal protected merchant transaction view.
- Automated tests and test-mode end-to-end validation.

### Phase 2 — Production readiness
- Review business/account identity, payout bank account, statement descriptor, refund/dispute process, tax and legal disclosures.
- Confirm Apple Pay domain verification and supported-device behavior.
- Security review, webhook replay/idempotency tests, and operational monitoring.
- Request explicit owner approval before switching any payment flow to live mode.

### Phase 3 — Expansion
- Dynamic invoices and order QR.
- Refund controls and reconciliation.
- Recurring memberships/subscriptions.
- Multi-business accounts only if later requested.
- Additional processors behind the adapter interface only when commercially justified.

## Initial implementation choice

Stripe's embedded Checkout experience is the selected starting pattern for the web checkout. It keeps the customer on DaHoodFarmer.com while delegating sensitive payment collection and processing to regulated infrastructure. This does not make DHF an independent payment processor.

## Launch gates

No live payments until:
- Stripe live account onboarding and payout details are complete.
- Production webhook endpoint and secrets are configured.
- Required domain/wallet setup is complete.
- Legal, refund, privacy, and customer support disclosures are reviewed.
- Test suite passes and the owner explicitly approves live activation.
