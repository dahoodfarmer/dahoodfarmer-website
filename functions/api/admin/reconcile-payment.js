import { createReceiptToken } from '../../lib/payment-receipts.js';
import { hashInvoiceToken } from '../../lib/invoices.js';
import { sendReceiptEmail } from '../../lib/receipt-email.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === new URL(request.url).origin;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === new URL(request.url).origin; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  const methods = typeof env.DHF_PAYMENT_METHODS === 'string' ? env.DHF_PAYMENT_METHODS.split(',').map(value => value.trim().toLowerCase()) : [];
  if (env.DHF_PAYMENTS_ENABLED !== 'true' || env.DHF_MANUAL_RECONCILIATION_ENABLED !== 'true' || env.DHF_PAYMENT_PROVIDER !== 'manual' || !methods.includes('bank_transfer')) {
    return json({ error: 'Manual bank-transfer reconciliation is disabled in this environment.' }, 503);
  }
  if (!env.DB || typeof env.DB.batch !== 'function') return json({ error: 'Atomic payment ledger operations are unavailable.' }, 503);
  if (typeof env.DHF_RECEIPT_TOKEN_SECRET !== 'string' || env.DHF_RECEIPT_TOKEN_SECRET.length < 32) {
    return json({ error: 'Receipt security is not configured; no payment status was changed.' }, 503);
  }
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid request.' }, 400);
  const invoiceId = typeof data.invoice_id === 'string' ? data.invoice_id.trim() : '';
  const amountCents = Number(data.amount_cents);
  const reference = typeof data.payment_reference === 'string' ? data.payment_reference.trim().slice(0, 120) : '';
  if (!invoiceId || invoiceId.length > 80) return json({ error: 'Valid invoice ID is required.' }, 422);
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) return json({ error: 'Enter the exact cleared invoice amount in cents.' }, 422);
  if (data.payment_method !== 'bank_transfer') return json({ error: 'Only bank transfer is available for manual reconciliation.' }, 422);
  if (data.cleared_funds_confirmed !== true) return json({ error: 'Confirm that cleared funds were independently verified in the business bank account.' }, 422);
  if (reference.length < 3) return json({ error: 'Enter a bank transfer reference or internal reconciliation note.' }, 422);

  try {
    const invoice = await env.DB.prepare(
      `SELECT i.invoice_id, i.partnership_id, i.amount_cents, i.currency, i.status, i.provider_id, i.provider_reference,
              a.name AS recipient_name, a.email AS recipient_email, a.organization AS business_name
       FROM sponsor_invoices i
       JOIN sponsor_partnerships s ON s.id = i.partnership_id
       JOIN opportunity_applications a ON a.id = s.application_id
       WHERE i.invoice_id = ? LIMIT 1`
    ).bind(invoiceId).first();
    if (!invoice) return json({ error: 'Invoice not found.' }, 404);
    if (Number(invoice.amount_cents) !== amountCents || invoice.currency !== 'usd') {
      return json({ error: 'The cleared amount must exactly match the approved invoice amount.' }, 409);
    }
    if (!invoice.recipient_email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(invoice.recipient_email)) {
      return json({ error: 'A valid customer email is required before payment can be marked paid and a receipt issued.' }, 422);
    }

    const alreadyReconciled = invoice.status === 'paid' && invoice.provider_id === 'manual' && invoice.provider_reference === reference;
    if (invoice.status === 'paid' && !alreadyReconciled) {
      return json({ error: 'This invoice is already paid under a different reconciliation reference. Review the ledger; do not overwrite it.' }, 409);
    }
    if (!alreadyReconciled && !['issued', 'pending'].includes(invoice.status)) {
      return json({ error: 'This invoice is not eligible for manual settlement reconciliation.' }, 409);
    }

    // Cloudflare D1 batch runs these statements in one atomic transaction.
    // Every dependent write is conditional on the invoice carrying this exact
    // paid state and reference, so a competing reconciliation cannot diverge
    // the partnership, receipt, or activity ledger from the invoice.
    const token = await createReceiptToken(invoiceId, env.DHF_RECEIPT_TOKEN_SECRET);
    const tokenHash = await hashInvoiceToken(token);
    const paidAt = new Date().toISOString();
    const receiptId = 'DHF-' + paidAt.slice(0, 10).replace(/-/g, '') + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const summary = 'Owner-verified bank transfer reconciled for DHF invoice ' + invoiceId + '. Receipt will be recorded in the payment ledger.';

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE sponsor_invoices
         SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')),
             payment_method = 'bank_transfer', provider_id = 'manual',
             provider_status = 'paid', provider_reference = ?, updated_at = datetime('now')
         WHERE invoice_id = ? AND amount_cents = ? AND currency = 'usd'
           AND status IN ('issued','pending')`
      ).bind(reference, invoiceId, amountCents),
      env.DB.prepare(
        `UPDATE sponsor_partnerships
         SET payment_status = 'paid', payment_provider_id = 'manual',
             payment_reference = ?, updated_at = datetime('now')
         WHERE id = ? AND EXISTS (
           SELECT 1 FROM sponsor_invoices
           WHERE invoice_id = ? AND status = 'paid' AND provider_id = 'manual' AND provider_reference = ?
             AND amount_cents = ? AND currency = 'usd'
         )`
      ).bind(reference, invoice.partnership_id, invoiceId, reference, amountCents),
      env.DB.prepare(
        `INSERT OR IGNORE INTO payment_receipts
          (receipt_id, invoice_id, partnership_id, receipt_token_hash, recipient_name, recipient_email,
           business_name, description, amount_cents, currency, payment_method, provider_id,
           provider_reference, paid_at, email_status)
         SELECT ?, i.invoice_id, i.partnership_id, ?, a.name, a.email, a.organization,
                i.description, i.amount_cents, i.currency, 'bank_transfer', 'manual', ?, ?, 'not_configured'
         FROM sponsor_invoices i
         JOIN sponsor_partnerships s ON s.id = i.partnership_id
         JOIN opportunity_applications a ON a.id = s.application_id
         WHERE i.invoice_id = ? AND i.status = 'paid' AND i.provider_id = 'manual'
           AND i.provider_reference = ? AND i.amount_cents = ? AND i.currency = 'usd'`
      ).bind(receiptId, tokenHash, reference, paidAt, invoiceId, reference, amountCents),
      env.DB.prepare(
        `INSERT INTO sponsor_activities (partnership_id, activity_type, summary)
         SELECT ?, 'payment', ?
         WHERE EXISTS (
           SELECT 1 FROM sponsor_invoices
           WHERE invoice_id = ? AND status = 'paid' AND provider_id = 'manual'
             AND provider_reference = ? AND amount_cents = ? AND currency = 'usd'
         ) AND NOT EXISTS (
           SELECT 1 FROM sponsor_activities
           WHERE partnership_id = ? AND activity_type = 'payment'
             AND summary LIKE ?
         )`
      ).bind(invoice.partnership_id, summary, invoiceId, reference, amountCents, invoice.partnership_id, '%invoice ' + invoiceId + '.%')
    ]);

    const confirmedInvoice = await env.DB.prepare(
      `SELECT status, provider_id, provider_reference, amount_cents, currency
       FROM sponsor_invoices WHERE invoice_id = ? LIMIT 1`
    ).bind(invoiceId).first();
    if (!confirmedInvoice || confirmedInvoice.status !== 'paid' || confirmedInvoice.provider_id !== 'manual' ||
        confirmedInvoice.provider_reference !== reference || Number(confirmedInvoice.amount_cents) !== amountCents ||
        confirmedInvoice.currency !== 'usd') {
      return json({ error: 'The atomic reconciliation did not confirm this exact payment. Reload the ledger and investigate before retrying.' }, 409);
    }

    const saved = await env.DB.prepare(
      `SELECT receipt_id, invoice_id, recipient_email, amount_cents, currency, paid_at, email_status
       FROM payment_receipts WHERE invoice_id = ? LIMIT 1`
    ).bind(invoiceId).first();
    if (!saved) return json({ error: 'The invoice is marked paid but the receipt record could not be confirmed. Keep payment controls disabled and investigate.' }, 500);

    const receipt = { ...saved, token, receipt_url: '/receipt/' + token };
    await sendReceiptEmail({ DB: env.DB, env, receipt });
    return json({
      success: true,
      invoice_id: invoiceId,
      payment_status: 'paid',
      receipt_id: receipt.receipt_id,
      receipt_url: receipt.receipt_url,
      email_status: receipt.email_status || 'not_configured',
      already_reconciled: alreadyReconciled
    });
  } catch (error) {
    console.error('DHF manual payment reconciliation failed:', error?.message || String(error));
    return json({ error: 'Payment reconciliation could not be completed. Reload the ledger before retrying.' }, 500);
  }
}
