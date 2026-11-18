# DHF Payment Center — Preview Security Review

**Scope:** `feature/dhf-provider-neutral-payment-center`, Cloudflare Pages Preview, Preview D1, and Cloudflare Access configuration reviewed 2026-11-18. This is an implementation review, not a penetration test or authorization to accept customer funds.

## Controls verified

- Cloudflare Access has a dedicated Preview application covering `*.dahoodfarmer-website.pages.dev`; its Allow policy is restricted to the owner's exact email identity. The application is not visible in the Access application launcher and uses a 24-hour session.
- The primary-domain Access application covers the admin pages and admin API paths on the apex, www, shop, and Pages.dev hostnames, with the same exact-email Allow policy.
- The Pages Functions admin middleware independently verifies the Cloudflare Access JWT signature using the Access JWKS, pins issuer and audience, checks expiration and not-before, and fails closed when required claims, keys, or configuration are unavailable.
- Admin write handlers use same-origin checks. Payment reconciliation additionally requires all payment/reconciliation/provider/method switches to match the explicitly configured manual bank-transfer mode.
- The public payment-options endpoint currently returns no methods and a disabled status.
- Invoice tokens are random opaque tokens; the database stores their SHA-256 hash. Invoice pages are no-store, no-index, and no-referrer.
- Receipt links use an HMAC-derived token and the database stores its SHA-256 hash. Receipt pages are no-store, no-index, no-referrer, and escape customer-controlled text.
- Reconciliation checks cleared-funds confirmation, exact amount, USD currency, invoice status, bank-transfer method, and a payment reference. Invoice, partnership, receipt, and activity writes now run in one Cloudflare D1 `batch()` transaction. Dependent writes are conditional on the exact paid invoice/reference; the handler reads back and verifies invoice, partnership, receipt provider/reference/amount/currency, and receipt-token hash before returning success. Receipt insertion is idempotent by invoice.
- Preview payment flags remain off. No Production database, secrets, DNS, or payment settings were changed.

## Improvement made during this review

Manual reconciliation previously changed the invoice to paid before the receipt helper checked whether the customer email was valid. A missing/invalid email could therefore leave a paid invoice without its required receipt. The handler now validates the receipt recipient before changing invoice status. A regression test covers the missing-email case. The handler now uses one atomic D1 batch for invoice, partnership, receipt, and activity writes; competing references cannot overwrite an already-paid invoice, and the response is withheld unless all three ledger records read back consistently. The idempotent retry test verifies only one invoice transition to paid and reuse of the original receipt.

## Remaining risks / acceptance gates

1. Atomic D1 batch behavior is covered by automated unit tests, but a real Preview D1 failure-injection test and authenticated owner-screen acceptance test remain required before any live collection. Confirm the deployed D1 schema and readback behavior under the actual Cloudflare runtime.
2. Cloudflare Access is the primary admin-page perimeter. The Pages middleware adds a second check for admin APIs; it does not replace the Access policy for static admin HTML. Keep both layers in place.
3. The owner must test an authenticated Preview session and verify a synthetic invoice, token rotation, ledger, receipt, and error messages on the actual iPhone UI.
4. No payment processor, merchant settlement account, customer payment method, refund workflow, tax treatment, or live payment is certified by this review.
5. Do not lift payment kill switches until merchant account ownership, settlement destination, refund/support procedures, customer disclosures, and legal/tax review are complete.

## Technical housekeeping

- GitHub Actions uses `actions/checkout@v5` and `actions/setup-node@v5`, Node 22, and `npm test`.
- The repository has no `package-lock.json`; CI currently does not install dependencies or build/deploy Wrangler. The non-fatal `punycode` warning has not been reproduced in the current GitHub Actions test job, so its originating command/dependency remains unverified. Do not suppress it or make a speculative dependency upgrade.
- The Vercel rate-limit failure is external to the successful GitHub test job and successful Cloudflare Pages Preview deployment. Do not change plans or spend money to clear it.

## Decision

**Preview implementation is suitable for continued owner acceptance testing, not live payment activation.** Keep all payment switches off, keep PR #26 draft and unmerged, and keep Production untouched.
