# Non-Stripe Payment Rail Evaluation

**Owner direction:** Stripe is permanently excluded. DHF retains its own Payment Center, invoice pages, QR codes, receipts, reporting and reconciliation. No provider account or live payment configuration is created by this evaluation.

## Recommendation

Keep direct bank transfer as a separate first-party payment option, with DHF publishing instructions only after the receiving business account is verified.

For Apple Pay, cards and optional ACH bank debit inside the DHF invoice experience, **Square Web Payments SDK is the leading non-Stripe candidate** to evaluate next. It supports an embedded web integration for Apple Pay and ACH, so DHF can retain its own invoice page and customer experience rather than redirecting customers to a hosted checkout. This is a recommendation, not an integration or account selection.

## Why Square is the lead candidate

- Square's Web Payments SDK supports card payments, Apple Pay and ACH bank transfer through the web integration.
- Square documents its API online card rate as 2.9% + $0.30 per transaction on the Free plan.
- Square documents ACH via the API as 1% with a $1 minimum and $5 fee cap on the Free plan.
- Square Free has no monthly subscription charge; processing fees apply when a payment is taken.
- Square handles ACH bank verification through its SDK; DHF would not need to create a separate Plaid account.

## Important settlement trade-off

Square ACH is not a direct buyer-bank-to-DHF-bank transfer. Square's documentation says the payment is received into the Square seller balance and then transferred to the seller's linked bank account. ACH payments are asynchronous and can take two to three business days to complete. Standard payout timing and instant-transfer fees/limits also apply.

Therefore:
- Use manual direct bank transfer when the goal is payment directly into DHF's verified bank account.
- Use Square ACH only if the owner accepts the Square balance and payout route.
- Use Square Apple Pay/card only if the owner accepts card-network processing fees and Square settlement.
- Never label Square ACH as a direct-to-bank payment.

## Other non-Stripe candidates

| Candidate | What it offers | Main trade-off |
|---|---|---|
| Authorize.net | Supports Apple Pay and eCheck/ACH; can work with an existing merchant account and supported processor | Apple Pay is available only when the underlying processor supports payment-network tokenization; setup requires merchant identity and certificate work |
| Braintree (PayPal) | Supports Apple Pay on the web through its JavaScript SDK | Requires Braintree merchant configuration, Apple Pay merchant/domain setup and provider-specific integration |
| Adyen | Supports Apple Pay web components and API-only integration | More complex merchant/customer-area configuration; likely a heavier onboarding path for a small initial launch |

## Security and architecture rules

- Keep all provider code behind the existing master payment kill switch.
- The browser may tokenize payment details through a provider SDK, but raw card or bank credentials must never reach DHF servers.
- The server must load the invoice amount and currency from DHF's database; ignore client-supplied amounts.
- Use idempotency keys for every charge request.
- Verify provider webhooks cryptographically and reconcile only authoritative completed/settled states.
- Never mark ACH paid while it is pending.
- Keep direct bank transfer and processor settlement as distinct payment methods and ledger routes.
- No provider credentials, certificates, webhook secrets, domain registrations, account creation, fees, Production changes or live payments are authorized by this evaluation.

## Official references

- Square Web Payments SDK: https://developer.squareup.com/reference/sdks/web/payments
- Square Apple Pay component: https://developer.squareup.com/reference/sdks/web/payments/digital-wallets/apple-pay
- Square ACH payments: https://developer.squareup.com/docs/payments-api/take-payments/ach-payments
- Square fees: https://squareup.com/us/en/payments/our-fees
- Square payouts: https://squareup.com/help/us/en/article/3807-deposit-options-with-square
- Authorize.net Apple Pay requirements: https://support.authorize.net/knowledgebase/Knowledgearticle/?code=KA-05457
- Braintree Apple Pay web guide: https://developer.paypal.com/braintree/docs/guides/apple-pay/client-side/javascript/v4/
- Adyen Apple Pay web component: https://docs.adyen.com/payment-methods/apple-pay/web-component/
