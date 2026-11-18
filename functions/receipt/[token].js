import { hashInvoiceToken } from '../lib/invoices.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function money(cents, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() }).format(Number(cents || 0) / 100);
}
export async function onRequestGet({ params, env }) {
  const token = typeof params?.token === 'string' ? params.token : '';
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token) || !env.DB) {
    return new Response('Receipt not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const tokenHash = await hashInvoiceToken(token);
  const receipt = await env.DB.prepare(
    'SELECT receipt_id, recipient_name, recipient_email, business_name, description, amount_cents, currency, payment_method, provider_id, provider_reference, paid_at FROM payment_receipts WHERE receipt_token_hash = ? LIMIT 1'
  ).bind(tokenHash).first();
  if (!receipt) return new Response('Receipt not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const date = new Date(receipt.paid_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' });
  const label = receipt.payment_method ? receipt.payment_method.replaceAll('_', ' ') : 'Processed payment';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Receipt ${escapeHtml(receipt.receipt_id)} — Da HoodFarmer</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#171717;font:16px/1.5 Arial,sans-serif}.wrap{max-width:760px;margin:3rem auto;padding:1.5rem}.receipt{background:#fff;border:1px solid #ddd;border-radius:14px;padding:2rem;box-shadow:0 8px 30px #0000000d}.brand-logo{display:block;width:82px;height:auto;max-height:86px;object-fit:contain;margin:0 0 .5rem}.brand{font-weight:800;letter-spacing:.12em;color:#5b3b8c}.sub{color:#666;font-size:.85rem;letter-spacing:.08em}.status{display:inline-block;border:1px solid #18794e;color:#18794e;border-radius:30px;padding:.25rem .75rem;font-weight:700;font-size:.8rem}.top{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;border-bottom:1px solid #ddd;padding-bottom:1.2rem}.meta{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.5rem 0}.muted{color:#666;font-size:.9rem}.total{display:flex;justify-content:space-between;border-top:2px solid #222;padding-top:1rem;margin-top:1.5rem;font-size:1.25rem;font-weight:700}.footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #ddd;color:#666;font-size:.85rem}.actions{display:flex;justify-content:flex-end;margin-bottom:1rem}button{border:0;background:#282036;color:white;padding:.7rem 1rem;border-radius:8px;font-weight:700}@media(max-width:600px){.wrap{padding:.75rem;margin:1rem auto}.receipt{padding:1.1rem}.top{display:block}.meta{grid-template-columns:1fr}}@media print{body{background:#fff}.wrap{margin:0;padding:0;max-width:none}.receipt{border:0;box-shadow:none}.actions{display:none}}
  </style></head><body><main class="wrap"><div class="actions"><button onclick="window.print()">Print / Save PDF</button></div><article class="receipt"><header class="top"><div><img class="brand-logo" src="/assets/dhf-carter-columbia-logo.webp" alt="Carter Columbia South Carolina emblem"><div class="brand">DA HOODFARMER</div><div class="sub">OFFICIAL PAYMENT RECEIPT</div></div><span class="status">PAID</span></header><div class="meta"><div><div class="muted">Receipt number</div><strong>${escapeHtml(receipt.receipt_id)}</strong></div><div><div class="muted">Payment date</div><strong>${escapeHtml(date)}</strong></div><div><div class="muted">Received from</div><strong>${escapeHtml(receipt.recipient_name)}</strong><div>${escapeHtml(receipt.business_name)}</div><div class="muted">${escapeHtml(receipt.recipient_email)}</div></div><div><div class="muted">Payment method</div><strong>${escapeHtml(label)}</strong><div class="muted">Recorded via: ${escapeHtml(receipt.provider_id)}</div></div></div><div><div class="muted">Description</div><strong>${escapeHtml(receipt.description)}</strong></div><div class="total"><span>Total paid</span><span>${money(receipt.amount_cents, receipt.currency)}</span></div><div class="footer">This receipt confirms that Da HoodFarmer recorded payment for the transaction shown above. Keep this document for your records. For questions, use the official contact page at dahoodfarmer.com/contact. Do not send payment credentials by email.</div></article></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
}
