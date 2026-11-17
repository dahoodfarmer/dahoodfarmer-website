import { createReceiptToken } from '../../lib/payment-receipts.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'Payment ledger is unavailable.' }, 503);
  const limitValue = Number(new URL(request.url).searchParams.get('limit') || 100);
  const limit = Number.isSafeInteger(limitValue) ? Math.min(250, Math.max(1, limitValue)) : 100;
  try {
    const result = await env.DB.prepare(
      `SELECT i.invoice_id, i.invoice_number, i.description, i.amount_cents, i.currency, i.status AS invoice_status,
              i.due_date, i.paid_at, i.provider_id, i.provider_invoice_id, i.provider_status, i.payment_method,
              s.id AS partnership_id, s.package_name, s.payment_status,
              a.name AS customer_name, a.email AS customer_email, a.organization AS business_name,
              r.receipt_id, r.email_status, r.emailed_at, r.processor_fee_cents, r.net_amount_cents
       FROM sponsor_invoices i
       JOIN sponsor_partnerships s ON s.id = i.partnership_id
       JOIN opportunity_applications a ON a.id = s.application_id
       LEFT JOIN payment_receipts r ON r.invoice_id = i.invoice_id
       ORDER BY COALESCE(i.paid_at, i.created_at) DESC LIMIT ?`
    ).bind(limit).all();
    const rows = result.results || [];
    const receipts = await Promise.all(rows.map(async row => {
      let receiptUrl = '';
      if (row.receipt_id && env.DHF_RECEIPT_TOKEN_SECRET) {
        const token = await createReceiptToken(row.invoice_id, env.DHF_RECEIPT_TOKEN_SECRET);
        receiptUrl = '/receipt/' + token;
      }
      return { ...row, receipt_url: receiptUrl };
    }));
    const summary = receipts.reduce((acc, row) => {
      if (row.invoice_status === 'paid') {
        acc.paid_count += 1;
        acc.gross_paid_cents += Number(row.amount_cents || 0);
      } else if (['issued', 'pending'].includes(row.invoice_status)) {
        acc.outstanding_count += 1;
        acc.outstanding_cents += Number(row.amount_cents || 0);
      }
      return acc;
    }, { paid_count: 0, gross_paid_cents: 0, outstanding_count: 0, outstanding_cents: 0 });
    return json({ summary, invoices: receipts, limit, receipt_links_enabled: Boolean(env.DHF_RECEIPT_TOKEN_SECRET) });
  } catch (error) {
    console.error('Payment ledger read failed:', error?.message || String(error));
    return json({ error: 'Payment ledger is temporarily unavailable. Confirm Preview migration 0012 has been applied.' }, 503);
  }
}
