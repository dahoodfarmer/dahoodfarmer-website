import { hashInvoiceToken } from './invoices.js';

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createReceiptToken(invoiceId, secret) {
  if (!invoiceId || typeof secret !== 'string' || secret.length < 32) {
    throw new Error('A dedicated receipt-token secret of at least 32 characters is required.');
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('dhf-receipt:' + invoiceId));
  return base64Url(new Uint8Array(signature));
}

export async function createPaidReceipt({ DB, env, invoiceId, providerId, providerReference, amountCents, currency = 'usd', paidAt, paymentMethod = null }) {
  if (!DB || !env?.DHF_RECEIPT_TOKEN_SECRET) throw new Error('Receipt storage is not configured.');
  if (!['stripe', 'flo', 'manual'].includes(providerId)) throw new Error('Unsupported receipt provider.');
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('Invalid paid amount.');
  if (currency !== 'usd') throw new Error('Unsupported receipt currency.');
  if (paymentMethod && !['apple_pay', 'card', 'ach', 'bank_transfer', 'other'].includes(paymentMethod)) throw new Error('Invalid receipt payment method.');

  const invoice = await DB.prepare(
    `SELECT i.invoice_id, i.partnership_id, i.description, i.amount_cents,
            a.name AS recipient_name, a.email AS recipient_email, a.organization AS business_name
     FROM sponsor_invoices i
     JOIN sponsor_partnerships s ON s.id = i.partnership_id
     JOIN opportunity_applications a ON a.id = s.application_id
     WHERE i.invoice_id = ? LIMIT 1`
  ).bind(invoiceId).first();
  if (!invoice) throw new Error('Paid invoice record was not found.');
  if (Number(invoice.amount_cents) !== amountCents) throw new Error('Receipt amount does not match the approved invoice.');
  if (!invoice.recipient_email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(invoice.recipient_email)) {
    throw new Error('A valid customer email is required before a receipt can be issued.');
  }

  const token = await createReceiptToken(invoiceId, env.DHF_RECEIPT_TOKEN_SECRET);
  const tokenHash = await hashInvoiceToken(token);
  const day = new Date(paidAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, '');
  const receiptId = 'DHF-' + day + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  await DB.prepare(
    `INSERT OR IGNORE INTO payment_receipts
      (receipt_id, invoice_id, partnership_id, receipt_token_hash, recipient_name, recipient_email,
       business_name, description, amount_cents, currency, payment_method, provider_id,
       provider_reference, paid_at, email_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_configured')`
  ).bind(
    receiptId, invoice.invoice_id, invoice.partnership_id, tokenHash,
    invoice.recipient_name || '', invoice.recipient_email, invoice.business_name || '',
    invoice.description, amountCents, currency, paymentMethod, providerId,
    providerReference || '', paidAt || new Date().toISOString()
  ).run();

  const saved = await DB.prepare(
    'SELECT receipt_id, invoice_id, recipient_email, amount_cents, currency, paid_at, email_status FROM payment_receipts WHERE invoice_id = ? LIMIT 1'
  ).bind(invoiceId).first();
  if (!saved) throw new Error('Receipt could not be confirmed in the ledger.');
  return { ...saved, token, receipt_url: '/receipt/' + token };
}
