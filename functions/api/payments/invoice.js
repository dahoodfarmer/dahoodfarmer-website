import { findInvoiceByToken } from '../../lib/invoices.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: 'This invoice link is invalid.' }, 400);
  if (!env.DB) return json({ error: 'Invoice records are unavailable.' }, 503);
  try {
    const invoice = await findInvoiceByToken(env.DB, token);
    if (!invoice) return json({ error: 'This invoice link could not be found.' }, 404);
    if (invoice.status === 'paid') return json({ invoice: { status: 'paid', amount_cents: invoice.amount_cents, currency: invoice.currency, description: invoice.description, organization: invoice.organization } });
    if (invoice.status === 'void' || invoice.status === 'expired') return json({ error: 'This invoice is no longer payable.' }, 410);
    if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) {
      await env.DB.prepare("UPDATE sponsor_invoices SET status = 'expired', updated_at = datetime('now') WHERE invoice_id = ? AND status IN ('issued','pending')").bind(invoice.invoice_id).run();
      return json({ error: 'This invoice has passed its due date. Please contact Da HoodFarmer for an updated invoice.' }, 410);
    }
    return json({
      invoice: {
        status: invoice.status,
        amount_cents: invoice.amount_cents,
        currency: invoice.currency,
        description: invoice.description,
        organization: invoice.organization || '',
        package_name: invoice.package_name || '',
        due_date: invoice.due_date || null
      },
      checkout_available: env.DHF_CHECKOUT_ENABLED === 'true' && Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY && env.PAYMENTS_DB)
    });
  } catch (error) {
    console.error('Public invoice lookup failed:', error?.message || String(error));
    return json({ error: 'Invoice details are temporarily unavailable.' }, 500);
  }
}
