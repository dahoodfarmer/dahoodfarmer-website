export async function sendReceiptEmail({ DB, env, receipt }) {
  if (env?.DHF_RECEIPT_EMAIL_ENABLED !== 'true') return { sent: false, reason: 'disabled' };
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !receipt?.recipient_email || !receipt?.receipt_url) {
    return { sent: false, reason: 'not_configured' };
  }

  const claim = await DB.prepare(
    "UPDATE payment_receipts SET email_status = 'pending' WHERE invoice_id = ? AND email_status IN ('not_configured','failed')"
  ).bind(receipt.invoice_id).run();
  if (Number(claim.meta?.changes || 0) !== 1) return { sent: false, reason: 'already_sent_or_pending' };

  const origin = env.PUBLIC_SITE_URL || 'https://dahoodfarmer.com';
  const url = new URL(receipt.receipt_url, origin).toString();
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(receipt.amount_cents || 0) / 100);
  const html = '<div style="font-family:Arial,sans-serif;color:#171717;max-width:620px;margin:auto"><h1 style="color:#5b3b8c">DA HOODFARMER</h1><p>Your payment has been recorded. Your official receipt is ready.</p><p><strong>Receipt:</strong> ' + receipt.receipt_id + '<br><strong>Amount paid:</strong> ' + amount + '</p><p><a href="' + url + '" style="display:inline-block;background:#282036;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View your receipt</a></p><p>You can print or save the receipt as a PDF. If you did not expect this payment, contact Da HoodFarmer through the official website.</p></div>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [receipt.recipient_email],
        subject: 'Your Da HoodFarmer payment receipt ' + receipt.receipt_id,
        html,
        tags: [{ name: 'type', value: 'payment-receipt' }]
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Receipt email delivery failed.');
    await DB.prepare("UPDATE payment_receipts SET email_status = 'sent', emailed_at = datetime('now') WHERE invoice_id = ?")
      .bind(receipt.invoice_id).run();
    return { sent: true, id: result.id || null };
  } catch (error) {
    await DB.prepare("UPDATE payment_receipts SET email_status = 'failed' WHERE invoice_id = ? AND email_status = 'pending'")
      .bind(receipt.invoice_id).run();
    console.error('DHF receipt email failed:', error?.message || String(error));
    return { sent: false, reason: 'delivery_failed' };
  }
}
