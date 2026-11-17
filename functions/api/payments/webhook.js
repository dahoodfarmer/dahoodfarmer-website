import { getPaymentProviderConfig, createStripeInvoiceAdapter } from '../../lib/payment-provider.js';
import { createPaidReceipt } from '../../lib/payment-receipts.js';
import { sendReceiptEmail } from '../../lib/receipt-email.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

async function claimEvent(DB, event) {
  const inserted = await DB.prepare(
    "INSERT OR IGNORE INTO payment_provider_events (provider_id, event_id, event_type, status, attempts, updated_at) VALUES ('stripe', ?, ?, 'processing', 1, datetime('now'))"
  ).bind(event.id, event.type).run();
  if (Number(inserted.meta?.changes || 0) === 1) return true;
  const retry = await DB.prepare(
    "UPDATE payment_provider_events SET status = 'processing', attempts = attempts + 1, updated_at = datetime('now'), last_error = NULL WHERE provider_id = 'stripe' AND event_id = ? AND (status = 'failed' OR (status = 'processing' AND updated_at < datetime('now', '-5 minutes')))"
  ).bind(event.id).run();
  return Number(retry.meta?.changes || 0) === 1;
}

async function completeEvent(DB, event) {
  await DB.prepare(
    "UPDATE payment_provider_events SET status = 'processed', processed_at = datetime('now'), updated_at = datetime('now'), last_error = NULL WHERE provider_id = 'stripe' AND event_id = ?"
  ).bind(event.id).run();
}

async function failEvent(DB, event, error) {
  await DB.prepare(
    "UPDATE payment_provider_events SET status = 'failed', updated_at = datetime('now'), last_error = ? WHERE provider_id = 'stripe' AND event_id = ? AND status = 'processing'"
  ).bind(String(error?.message || error || 'Processing failed').slice(0, 500), event.id).run();
}

export async function onRequestPost({ request, env }) {
  const paymentConfig = getPaymentProviderConfig(env);
  if (!paymentConfig.paymentsEnabled || paymentConfig.provider !== 'stripe' || !env.STRIPE_WEBHOOK_SECRET || !env.DB) return json({ error: 'The selected payment provider webhook is not enabled in this environment.' }, 503);
  const provider = createStripeInvoiceAdapter(env);
  const raw = await request.text();
  if (!await provider.verifyWebhook(raw, request.headers.get('Stripe-Signature'))) return json({ error: 'Invalid signature.' }, 400);
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid event.' }, 400); }
  const expectedLiveMode = env.DHF_STRIPE_EXPECT_LIVEMODE === 'true';
  if (typeof event.livemode !== 'boolean' || event.livemode !== expectedLiveMode) {
    return json({ error: 'Stripe event mode does not match this environment.' }, 400);
  }
  if (!event.id || typeof event.id !== 'string' || !event.type) return json({ error: 'Invalid event envelope.' }, 400);
  const object = event.data?.object;
  if (!object) return json({ received: true });
  if (event.type === 'invoice.paid' && (!env.DHF_RECEIPT_TOKEN_SECRET || env.DHF_RECEIPT_TOKEN_SECRET.length < 32)) {
    return json({ error: 'Receipt security is not configured; paid-event reconciliation will retry.' }, 503);
  }

  const supported = new Set(['charge.refunded','invoice.finalized','invoice.paid','invoice.payment_failed','invoice.voided']);
  if (!supported.has(event.type)) return json({ received: true });

  try {
    let record;
    let stripeInvoiceId;
    if (event.type === 'charge.refunded') {
      stripeInvoiceId = typeof object.invoice === 'string' ? object.invoice : object.invoice?.id;
      if (!stripeInvoiceId) return json({ received: true });
      record = await env.DB.prepare('SELECT invoice_id, partnership_id, amount_cents FROM sponsor_invoices WHERE stripe_invoice_id = ?').bind(stripeInvoiceId).first();
    } else {
      const invoiceId = object.metadata?.dhf_invoice_id || '';
      const partnershipMeta = object.metadata?.dhf_partnership_id || '';
      record = await env.DB.prepare(
        'SELECT invoice_id, partnership_id, amount_cents FROM sponsor_invoices WHERE stripe_invoice_id = ? OR invoice_id = ? LIMIT 1'
      ).bind(object.id, invoiceId).first();
      if (!record) return json({ received: true });
      if (invoiceId && invoiceId !== record.invoice_id) return json({ error: 'Invoice metadata mismatch.' }, 400);
      if (partnershipMeta && Number(partnershipMeta) !== Number(record.partnership_id)) return json({ error: 'Partnership metadata mismatch.' }, 400);
      if (object.currency && object.currency !== 'usd') return json({ error: 'Invoice currency mismatch.' }, 400);
      if (Number.isFinite(Number(object.total)) && Number(object.total) !== Number(record.amount_cents)) return json({ error: 'Invoice amount mismatch.' }, 400);
      if (event.type === 'invoice.paid') {
        const paidAmount = Number(object.amount_paid ?? object.total);
        if (!Number.isSafeInteger(paidAmount) || paidAmount !== Number(record.amount_cents)) {
          return json({ error: 'Paid amount does not match the approved invoice.' }, 400);
        }
      }
    }
    if (!record) return json({ received: true });

    const claimed = await claimEvent(env.DB, event);
    if (!claimed) return json({ received: true, duplicate: true });

    try {
      if (event.type === 'charge.refunded') {
        const refunded = Math.min(Number(record.amount_cents), Math.max(0, Number(object.amount_refunded || 0)));
        const fullyRefunded = refunded >= Number(record.amount_cents);
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET refund_amount_cents = MAX(refund_amount_cents, ?), provider_id = 'stripe', provider_invoice_id = ?, provider_status = CASE WHEN MAX(refund_amount_cents, ?) >= amount_cents THEN 'refunded' ELSE 'partially_refunded' END, updated_at = datetime('now') WHERE invoice_id = ?"
        ).bind(refunded, stripeInvoiceId, refunded, record.invoice_id).run();
        if (fullyRefunded) {
          await env.DB.prepare("UPDATE sponsor_partnerships SET payment_status = 'refunded', payment_provider_id = 'stripe', updated_at = datetime('now') WHERE id = ?").bind(record.partnership_id).run();
        }
      } else if (event.type === 'invoice.finalized') {
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'issued' END, stripe_status = ?, provider_id = 'stripe', provider_invoice_id = ?, provider_status = ?, hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'void'"
        ).bind(object.status || 'open', object.id, object.status || 'open', object.hosted_invoice_url || '', object.invoice_pdf || '', object.number || '', record.invoice_id).run();
        if (object.hosted_invoice_url) {
          await env.DB.prepare("UPDATE sponsor_partnerships SET payment_status = CASE WHEN payment_status IN ('paid','refunded','failed') THEN payment_status ELSE 'invoice_sent' END, payment_provider_id = 'stripe', invoice_url = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(object.hosted_invoice_url, record.partnership_id).run();
        }
      } else if (event.type === 'invoice.paid') {
        const paidAmount = Number(object.amount_paid ?? object.total);
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET status = 'paid', stripe_status = 'paid', provider_id = 'stripe', provider_invoice_id = ?, provider_status = 'paid', hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE invoice_id = ?"
        ).bind(object.id, object.hosted_invoice_url || '', object.invoice_pdf || '', object.number || '', record.invoice_id).run();
        await env.DB.prepare(
          "UPDATE sponsor_partnerships SET payment_status = 'paid', payment_provider_id = 'stripe', payment_reference = ?, invoice_url = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(object.id, object.hosted_invoice_url || '', record.partnership_id).run();
        const receipt = await createPaidReceipt({
          DB: env.DB, env, invoiceId: record.invoice_id, providerId: 'stripe',
          providerReference: typeof object.payment_intent === 'string' ? object.payment_intent : object.id,
          amountCents: paidAmount, currency: object.currency || 'usd',
          paidAt: object.status_transitions?.paid_at ? new Date(object.status_transitions.paid_at * 1000).toISOString() : new Date().toISOString(),
          paymentMethod: null
        });
        await sendReceiptEmail({ DB: env.DB, env, receipt });
      } else if (event.type === 'invoice.payment_failed') {
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET stripe_status = ?, provider_id = 'stripe', provider_invoice_id = ?, provider_status = ?, hosted_invoice_url = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'void'"
        ).bind(object.status || 'open', object.id, object.status || 'open', object.hosted_invoice_url || '', record.invoice_id).run();
        await env.DB.prepare(
          "UPDATE sponsor_partnerships SET payment_status = 'failed', payment_provider_id = 'stripe', invoice_url = ?, updated_at = datetime('now') WHERE id = ? AND payment_status NOT IN ('paid','refunded')"
        ).bind(object.hosted_invoice_url || '', record.partnership_id).run();
      } else if (event.type === 'invoice.voided') {
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET status = 'void', stripe_status = 'void', provider_id = 'stripe', provider_invoice_id = ?, provider_status = 'void', updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'paid'"
        ).bind(object.id, record.invoice_id).run();
        await env.DB.prepare(
          "UPDATE sponsor_partnerships SET payment_status = 'not_requested', payment_provider_id = 'stripe', invoice_url = '', payment_reference = '', updated_at = datetime('now') WHERE id = ? AND payment_status NOT IN ('paid','refunded')"
        ).bind(record.partnership_id).run();
      }
      await completeEvent(env.DB, event);
      return json({ received: true });
    } catch (error) {
      await failEvent(env.DB, event, error);
      throw error;
    }
  } catch (error) {
    console.error('Stripe invoice webhook reconciliation failed:', error?.message || String(error));
    return json({ error: 'Temporary processing error.' }, 500);
  }
}
