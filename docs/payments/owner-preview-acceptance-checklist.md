# DHF Payment Center — Owner Preview Acceptance Checklist

Use synthetic records only. Do not enter real customer information, bank details, card details, or make a payment. Complete this checklist while signed in through the Cloudflare Access owner account on the Preview deployment.

## A. Access and navigation
- [ ] Open the Preview link in a private/incognito browser session.
- [ ] Confirm Cloudflare Access requires owner authentication.
- [ ] Confirm the owner admin page loads after email verification.
- [ ] Confirm the sponsor CRM, prospect CRM, and payment ledger navigation links work.
- [ ] Confirm the public payment options show disabled/no available methods.

## B. Synthetic sponsor record
- [ ] Create one clearly labeled TEST sponsor record using an invalid test email domain such as `example.invalid`.
- [ ] Save and reload the page.
- [ ] Confirm the record persists and appears only in Preview.
- [ ] Confirm the interface reports success or a specific validation error beside the action; no silent failure.

## C. Agreement and invoice
- [ ] Use a synthetic application/partnership only.
- [ ] Confirm invoice creation is unavailable until the agreement status is signed.
- [ ] Confirm the invoice amount is taken from the server-approved agreed amount, not a browser-edited value.
- [ ] Create a TEST invoice only if the Preview owner workflow allows it.
- [ ] Open the invoice link and confirm the displayed amount, recipient, due date, and description.
- [ ] Resume/rotate the invoice link and confirm the old token returns not found while the new token works.
- [ ] Confirm invoice QR encodes only the secure invoice URL.

## D. Ledger and payment safety
- [ ] Confirm the new synthetic invoice appears in the owner ledger.
- [ ] Confirm status remains issued/unpaid.
- [ ] Confirm payment options remain empty and no checkout or provider redirect is offered.
- [ ] Confirm the public payment-options endpoint reports disabled.
- [ ] Do not enable reconciliation switches or submit a synthetic "paid" action unless separately approved for a dedicated Preview-only test.

## E. Receipt acceptance (after a separately authorized Preview-only reconciliation test)
- [ ] Confirm exact-amount mismatch is rejected.
- [ ] Confirm missing/invalid customer email is rejected before invoice status changes.
- [ ] Confirm cross-origin requests are rejected.
- [ ] Confirm a void invoice cannot be reconciled.
- [ ] Confirm a valid synthetic receipt is created once and a retry reuses the same receipt ID.
- [ ] Open the receipt URL and verify the receipt number, recipient, amount, date, payment method, print/save action, and no-index behavior.
- [ ] Confirm receipt URL is not exposed on public pages or search indexes.

## F. Closeout
- [ ] Remove all synthetic applications, partnerships, invoices, and receipts from Preview.
- [ ] Verify Preview database contains no remaining test records.
- [ ] Capture any error message exactly as displayed.
- [ ] Confirm Production remains unchanged.
- [ ] Leave PR #26 draft/unmerged until all acceptance gates are satisfied.

## Owner stop conditions

Stop and report the exact screen/message if a page is blank, an action spins without feedback, a record appears twice, a revoked invoice link still opens, an unpaid invoice displays paid, a payment destination appears unexpectedly, or any screen requests card/bank credentials.
