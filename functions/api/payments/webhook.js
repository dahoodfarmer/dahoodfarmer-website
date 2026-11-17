const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp + '.' + payload));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some(signature => constantTimeEqual(signature, expected));
}
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.DB) return json({ error: 'Stripe invoice webhook is not configured.' }, 503);
  const raw = await request.text();
  if (!await verifyStripeSignature(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET)) return json({ error: 'Invalid signature.' }, 400);
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid event.' }, 400); }
  const object = event.data?.object;
  if (!object) return json({ received: true });

  try {
    if (event.type === 'charge.refunded') {
      const stripeInvoiceId = typeof object.invoice === 'string' ? object.invoice : object.invoice?.id;
      if (!stripeInvoiceId) return json({ received: true });
      const record = await env.DB.prepare('SELECT invoice_id, partnership_id, amount_cents FROM sponsor_invoices WHERE stripe_invoice_id = ?').bind(stripeInvoiceId).first();
      if (!record) return json({ received: true });
      const refunded = Math.max(0, Number(object.amount_refunded || 0));
      const fullyRefunded = refunded >= Number(record.amount_cents);
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET refund_amount_cents = MAX(refund_amount_cents, ?), updated_at = datetime('now') WHERE invoice_id = ?"
      ).bind(refunded, record.invoice_id).run();
      if (fullyRefunded) {
        await env.DB.prepare("UPDATE sponsor_partnerships SET payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?").bind(record.partnership_id).run();
      }
      await env.DB.prepare('INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)').bind(event.id, event.type).run();
      return json({ received: true });
    }

    const supported = new Set(['invoice.finalized','invoice.paid','invoice.payment_failed','invoice.voided']);
    if (!supported.has(event.type)) return json({ received: true });
    const invoiceId = object.metadata?.dhf_invoice_id || '';
    const partnershipMeta = object.metadata?.dhf_partnership_id || '';
    const record = await env.DB.prepare(
      'SELECT invoice_id, partnership_id, amount_cents FROM sponsor_invoices WHERE stripe_invoice_id = ? OR invoice_id = ? LIMIT 1'
    ).bind(object.id, invoiceId).first();
    if (!record) return json({ received: true });
    if (invoiceId && invoiceId !== record.invoice_id) return json({ error: 'Invoice metadata mismatch.' }, 400);
    if (partnershipMeta && Number(partnershipMeta) !== Number(record.partnership_id)) return json({ error: 'Partnership metadata mismatch.' }, 400);
    if (object.currency && object.currency !== 'usd') return json({ error: 'Invoice currency mismatch.' }, 400);
    if (Number.isFinite(Number(object.total)) && Number(object.total) !== Number(record.amount_cents)) return json({ error: 'Invoice amount mismatch.' }, 400);

    await env.DB.prepare('INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)').bind(event.id, event.type).run();
    if (event.type === 'invoice.finalized') {
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'issued' END, stripe_status = ?, hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'void'"
      ).bind(object.status || 'open', object.hosted_invoice_url || '', object.invoice_pdf || '', object.number || '', record.invoice_id).run();
      if (object.hosted_invoice_url) {
        await env.DB.prepare("UPDATE sponsor_partnerships SET payment_status = CASE WHEN payment_status IN ('paid','refunded','failed') THEN payment_status ELSE 'invoice_sent' END, invoice_url = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(object.hosted_invoice_url, record.partnership_id).run();
      }
    } else if (event.type === 'invoice.paid') {
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET status = 'paid', stripe_status = 'paid', hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE invoice_id = ?"
      ).bind(object.hosted_invoice_url || '', object.invoice_pdf || '', object.number || '', record.invoice_id).run();
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET payment_status = 'paid', payment_reference = ?, invoice_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(object.id, object.hosted_invoice_url || '', record.partnership_id).run();
    } else if (event.type === 'invoice.payment_failed') {
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET stripe_status = ?, hosted_invoice_url = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'void'"
      ).bind(object.status || 'open', object.hosted_invoice_url || '', record.invoice_id).run();
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET payment_status = 'failed', invoice_url = ?, updated_at = datetime('now') WHERE id = ? AND payment_status NOT IN ('paid','refunded')"
      ).bind(object.hosted_invoice_url || '', record.partnership_id).run();
    } else if (event.type === 'invoice.voided') {
      await env.DB.prepare(
        "UPDATE sponsor_invoices SET status = 'void', stripe_status = 'void', updated_at = datetime('now') WHERE invoice_id = ? AND status <> 'paid'"
      ).bind(record.invoice_id).run();
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET payment_status = 'not_requested', invoice_url = '', payment_reference = '', updated_at = datetime('now') WHERE id = ? AND payment_status NOT IN ('paid','refunded')"
      ).bind(record.partnership_id).run();
    }
    return json({ received: true });
  } catch (error) {
    console.error('Stripe invoice webhook reconciliation failed:', error?.message || String(error));
    return json({ error: 'Temporary processing error.' }, 500);
  }
}
