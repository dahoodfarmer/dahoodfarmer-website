import { createPaidReceipt } from '../../lib/payment-receipts.js';
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
  if (!env.DB) return json({ error: 'Payment ledger is unavailable.' }, 503);
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
      `SELECT i.invoice_id, i.partnership_id, i.amount_cents, i.currency, i.status, i.provider_id,
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

    const alreadyReconciled = invoice.status === 'paid' && invoice.provider_id === 'manual';
    if (!alreadyReconciled && !['issued', 'pending'].includes(invoice.status)) {
      return json({ error: 'This invoice is not eligible for manual settlement reconciliation.' }, 409);
    }

    if (!alreadyReconciled) {
      const changed = await env.DB.prepare(
        "UPDATE sponsor_invoices SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')), payment_method = 'bank_transfer', provider_id = 'manual', provider_status = 'paid', provider_reference = ?, updated_at = datetime('now') WHERE invoice_id = ? AND amount_cents = ? AND status IN ('issued','pending')"
      ).bind(reference, invoiceId, amountCents).run();
      if (Number(changed.meta?.changes || 0) !== 1) {
        return json({ error: 'Invoice status changed during reconciliation. Reload the ledger and verify it before retrying.' }, 409);
      }
    }

    await env.DB.prepare(
      "UPDATE sponsor_partnerships SET payment_status = 'paid', payment_provider_id = 'manual', payment_reference = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(reference, invoice.partnership_id).run();

    const receipt = await createPaidReceipt({
      DB: env.DB, env, invoiceId, providerId: 'manual', providerReference: reference,
      amountCents, currency: invoice.currency, paidAt: new Date().toISOString(), paymentMethod: 'bank_transfer'
    });
    await sendReceiptEmail({ DB: env.DB, env, receipt });
    if (!alreadyReconciled) {
      await env.DB.prepare(
        "INSERT INTO sponsor_activities (partnership_id, activity_type, summary) VALUES (?, 'payment', ?)"
      ).bind(invoice.partnership_id, 'Owner-verified bank transfer reconciled for DHF invoice ' + invoiceId + '. Receipt ' + receipt.receipt_id + '.').run();
    }

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
