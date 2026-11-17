export async function hashInvoiceToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function findInvoiceByToken(DB, token) {
  const tokenHash = await hashInvoiceToken(token);
  return DB.prepare(
    "SELECT i.invoice_id, i.partnership_id, i.amount_cents, i.currency, i.description, i.due_date, i.status, i.payment_order_id, s.package_name, s.contract_status, a.organization, a.email AS contact_email FROM sponsor_invoices i JOIN sponsor_partnerships s ON s.id = i.partnership_id JOIN opportunity_applications a ON a.id = s.application_id WHERE i.token_hash = ?"
  ).bind(tokenHash).first();
}

export async function reconcileInvoice(DB, invoiceId, partnershipId, orderId, status) {
  if (!DB || !invoiceId || !partnershipId || !orderId) throw new Error('Invoice reconciliation data is incomplete.');
  if (status === 'processing') {
    await DB.prepare("UPDATE sponsor_invoices SET status = 'pending', payment_order_id = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status IN ('issued','pending','expired')").bind(orderId, invoiceId).run();
    await DB.prepare("UPDATE sponsor_partnerships SET payment_status = 'pending', payment_reference = ?, updated_at = datetime('now') WHERE id = ? AND payment_status <> 'paid'").bind(orderId, partnershipId).run();
    return;
  }
  if (status === 'paid') {
    await DB.prepare(
      "UPDATE sponsor_invoices SET status = 'paid', payment_order_id = ?, paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE invoice_id = ? AND status IN ('issued','pending')"
    ).bind(orderId, invoiceId).run();
    await DB.prepare(
      "UPDATE sponsor_partnerships SET payment_status = 'paid', payment_reference = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(orderId, partnershipId).run();
    return;
  }
  if (status === 'expired') {
    const invoice = await DB.prepare('SELECT due_date, status FROM sponsor_invoices WHERE invoice_id = ?').bind(invoiceId).first();
    if (!invoice || invoice.status === 'paid' || invoice.status === 'void') return;
    const overdue = invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10);
    await DB.prepare("UPDATE sponsor_invoices SET status = ?, updated_at = datetime('now') WHERE invoice_id = ? AND status = 'pending'")
      .bind(overdue ? 'expired' : 'issued', invoiceId).run();
    await DB.prepare("UPDATE sponsor_partnerships SET payment_status = ?, updated_at = datetime('now') WHERE id = ? AND payment_status IN ('pending','failed')")
      .bind(overdue ? 'failed' : 'invoice_sent', partnershipId).run();
    return;
  }
  if (status === 'failed') {
    await DB.prepare("UPDATE sponsor_invoices SET status = 'issued', updated_at = datetime('now') WHERE invoice_id = ? AND status = 'pending'").bind(invoiceId).run();
    await DB.prepare("UPDATE sponsor_partnerships SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ? AND payment_status <> 'paid'").bind(partnershipId).run();
  }
}
