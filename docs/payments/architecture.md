# DHF Sponsor Invoicing — Stripe Hosted Invoice Page

**Status:** Preview implementation; invoice issuing is disabled by default.
**Purpose:** Collect one-time sponsor payments only after an owner-approved written agreement has been signed.

## Owner-controlled process

1. A company submits the public sponsor inquiry form.
2. The owner reviews the inquiry in the Cloudflare Access-protected Sponsor CRM.
3. The owner qualifies the prospect, records the package and agreed amount, and stores the signed agreement link and date.
4. The owner sets an invoice due date and clicks **Issue / resume Stripe invoice**.
5. The backend creates or reuses a Stripe Customer, creates a one-time send-invoice invoice and invoice item, finalizes the invoice, and stores the Stripe invoice ID and hosted invoice URL in D1.
6. The backend does not send an invoice email automatically. The owner reviews and shares the hosted invoice URL with the contracted sponsor.
7. The sponsor pays on Stripe's hosted invoice page. DHF does not collect or store card numbers or security codes.
8. A signed Stripe webhook updates the invoice and sponsor CRM. A browser redirect or screenshot is never treated as proof of payment.
9. The owner tracks deliverables, evidence, payment status and renewal dates in the Sponsor CRM.

## Stripe integration

- Stripe Invoicing API: Customer, Invoice Item, Invoice create, and Invoice finalize operations.
- Collection method: `send_invoice`.
- Payment page: Stripe-hosted invoice page (`hosted_invoice_url`).
- Automatic email sending is not invoked; the owner shares the link manually.
- Invoice metadata includes DHF invoice, partnership and application identifiers.
- Idempotency keys are used for customer, invoice, invoice-item and finalize requests.
- Required webhook events: `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, and `charge.refunded`.
- The webhook signature is verified against the raw request body with a five-minute timestamp tolerance.
- Webhook event IDs are retained in the main D1 database for audit and deduplication.
- Payment status is updated only from verified Stripe webhook events, not by editing the CRM form.

## Data boundaries

- Main D1 `DB`: sponsor applications, CRM partnerships, agreements, deliverables, activities, Stripe customer/invoice IDs, hosted invoice URLs and webhook event IDs.
- `SESSIONS`: application and admin rate limiting.
- No separate payment ledger database is required for Stripe Invoicing.
- Production databases, secrets, DNS and deployments remain untouched by this Preview implementation.

## Tax and payment configuration gate

Automatic tax is not enabled in this implementation. Sponsor invoice tax treatment must be confirmed before enabling invoice creation. Stripe Tax requires appropriate tax registrations and configuration; do not assume sponsorship fees are tax-exempt or taxable without qualified accounting advice.

The owner must also confirm:
- Whether sponsor fees require sales tax, VAT or GST, and where.
- Stripe account test-mode credentials and business/payout setup.
- Invoice branding, payment methods, due-date policy and reminder settings.
- The webhook endpoint and exact event subscriptions.
- Refund, credit-note and cancellation handling.
- Customer-facing invoice terms and applicable tax language.

Keep `DHF_INVOICING_ENABLED=false` until these decisions and test-mode validation are complete.

## Explicitly not included

- Live-mode charges or automatic invoice emails.
- Recurring sponsorship subscriptions.
- Self-service sponsor package checkout.
- Public marketplace or ticket checkout.
- Electronic signatures or automatic contract generation.
- FLO Business Solutions integration or replacement of Stripe.
