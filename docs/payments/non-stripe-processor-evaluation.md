# Payment Route Decision — Direct Bank Transfer Only

**Owner direction:** Stripe and Square are excluded. DHF is not selecting a third-party payment processor, hosted checkout, card checkout, Apple Pay, ACH debit or wallet checkout.

## Current decision

Keep the DHF Payment Center, invoices, QR codes, payment status, receipts, reporting and reconciliation as first-party DHF functions. The only payment route under consideration is a direct bank-to-bank transfer to a verified DHF business account.

This is not active yet. No bank account details or payment destination are published, and no customer is instructed to send money.

## Bank verification required before launch

The owner must confirm directly with the receiving bank:

- Whether the account is a business account and is approved for commercial receipts.
- Which incoming transfer types are supported for business invoice payments.
- Whether incoming ACH credits, domestic wires or other transfer types are available.
- Settlement timing, holds, limits, return/reversal rules and any account or transfer fees.
- What payer information or invoice reference should accompany a transfer.
- Whether the bank provides transaction notifications or downloadable statements suitable for reconciliation.

Do not publish personal account details or use personal peer-to-peer payment handles as business payment destinations.

## Reconciliation rules

- Customer instructions must identify the exact invoice amount and invoice number reference.
- A screenshot, remittance advice, email, text or payment promise is not proof of settlement.
- Only the owner may reconcile an invoice after independently confirming cleared funds in the DHF business bank account.
- The amount and currency must exactly match the issued invoice.
- Receipt generation follows successful reconciliation only.
- All payment switches remain off until the owner separately approves real-money operation.

## Explicit exclusions

- Stripe and Square.
- PayPal, Venmo, Cash App, Chime Pay Anyone and other personal wallet/P2P checkout.
- Card checkout, Apple Pay, ACH debit and third-party hosted checkout.
- Any processor account creation, credentials, SDK, webhook, transaction, fee or paid service.

No processor comparison or integration work is authorized by this decision. Revisit only if the owner explicitly changes the payment model.
