const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === new URL(request.url).origin;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === new URL(request.url).origin; } catch { return false; }
}

function page() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DHF Preview D1 Rollback Test</title>
<style>
body{font:16px system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 18px;color:#171717}
h1{font-size:24px}p{line-height:1.5}.notice{padding:14px;border:1px solid #aaa;border-radius:10px;margin:18px 0}
button{font:600 16px system-ui;padding:14px 18px;border:0;border-radius:9px;background:#222;color:white}
button:disabled{opacity:.55}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f3f3;padding:14px;border-radius:9px}
</style>
</head>
<body>
<h1>Preview database rollback verification</h1>
<div class="notice"><strong>Safe test scope:</strong> Preview D1 only. This creates one clearly labeled synthetic QA application, partnership, and invoice, deliberately forces a receipt constraint failure inside D1 batch(), checks that every earlier write rolled back, and deletes the synthetic records. It does not enable payment switches, call the payment endpoint, email anyone, or touch Production.</div>
<p>Run this only on the protected DHF Preview environment. The test may take several seconds.</p>
<button id="run" type="button">Run Preview rollback test</button>
<pre id="result" aria-live="polite">Waiting for owner action.</pre>
<script>
const button=document.getElementById('run');
const output=document.getElementById('result');
button.addEventListener('click',async()=>{
  button.disabled=true;
  output.textContent='Running isolated Preview database test…';
  try{
    const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});
    const body=await response.json();
    output.textContent=JSON.stringify(body,null,2);
  }catch(error){output.textContent='Test request failed: '+String(error);}
  finally{button.disabled=false;}
});
</script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function onRequestGet({ request, env }) {
  const host = new URL(request.url).hostname;
  if (env.CF_PAGES_BRANCH !== 'feature/dhf-provider-neutral-payment-center' || !host.endsWith('.pages.dev')) {
    return json({ error: 'Preview-only QA route not available.' }, 404);
  }
  return page();
}

export async function onRequestPost({ request, env }) {
  const host = new URL(request.url).hostname;
  if (env.CF_PAGES_BRANCH !== 'feature/dhf-provider-neutral-payment-center' || !host.endsWith('.pages.dev')) {
    return json({ error: 'Preview-only QA route not available.' }, 404);
  }
  if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.DB || typeof env.DB.batch !== 'function') return json({ error: 'Preview D1 batch binding unavailable.' }, 503);

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const email = 'dhf-atomic-qa-' + suffix + '@example.invalid';
  const invoiceId = 'DHF-ATOMIC-QA-' + suffix.toUpperCase();
  const reference = 'QA-ROLLBACK-' + suffix.toUpperCase();
  const tokenHash = 'qa-token-hash-' + suffix;
  const receiptId = 'DHF-QA-' + suffix.toUpperCase();
  const summary = 'Synthetic rollback QA activity ' + suffix;
  let setupComplete = false;
  let rollbackError = null;
  let checks = null;
  let cleanupComplete = false;

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO opportunity_applications
          (application_type,name,email,organization,country,message,status)
         VALUES ('sponsor','DHF Atomic Rollback QA',?,'Internal QA Only','United States','Synthetic rollback test; not a customer application.','approved')`
      ).bind(email),
      env.DB.prepare(
        `INSERT INTO sponsor_partnerships
          (application_id,division,stage,package_name,proposed_amount_cents,agreed_amount_cents,payment_status)
         SELECT id,'advertising_media','contracted','Internal QA Only',125000,125000,'invoice_sent'
         FROM opportunity_applications WHERE email=?`
      ).bind(email),
      env.DB.prepare(
        `INSERT INTO sponsor_invoices
          (invoice_id,partnership_id,amount_cents,currency,description,status,token_hash,provider_id,provider_status)
         SELECT ?,id,125000,'usd','Synthetic D1 rollback verification only','issued',?,'unconfigured','unconfigured'
         FROM sponsor_partnerships
         WHERE application_id=(SELECT id FROM opportunity_applications WHERE email=?)`
      ).bind(invoiceId, tokenHash, email)
    ]);
    setupComplete = true;

    const partnership = await env.DB.prepare(
      'SELECT id FROM sponsor_partnerships WHERE application_id=(SELECT id FROM opportunity_applications WHERE email=?) LIMIT 1'
    ).bind(email).first();
    if (!partnership?.id) throw new Error('Synthetic partnership seed was not created.');

    try {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE sponsor_invoices
           SET status='paid', paid_at=datetime('now'), payment_method='bank_transfer',
               provider_id='manual', provider_status='paid', provider_reference=?, updated_at=datetime('now')
           WHERE invoice_id=? AND status='issued'`
        ).bind(reference, invoiceId),
        env.DB.prepare(
          `UPDATE sponsor_partnerships
           SET payment_status='paid', payment_provider_id='manual', payment_reference=?, updated_at=datetime('now')
           WHERE id=? AND EXISTS (
             SELECT 1 FROM sponsor_invoices
             WHERE invoice_id=? AND status='paid' AND provider_reference=?
           )`
        ).bind(reference, partnership.id, invoiceId, reference),
        env.DB.prepare(
          `INSERT INTO payment_receipts
            (receipt_id,invoice_id,partnership_id,receipt_token_hash,recipient_name,recipient_email,
             business_name,description,amount_cents,currency,payment_method,provider_id,
             provider_reference,paid_at,email_status)
           VALUES (?,?,?,?,?,?,?,?,125000,'usd','bank_transfer','qa-invalid-provider',?,datetime('now'),'not_configured')`
        ).bind(receiptId, invoiceId, partnership.id, 'qa-receipt-hash-' + suffix,
          'DHF Atomic Rollback QA', email, 'Internal QA Only', 'Intentional constraint failure', reference),
        env.DB.prepare(
          `INSERT INTO sponsor_activities (partnership_id,activity_type,summary)
           VALUES (?,'payment',?)`
        ).bind(partnership.id, summary)
      ]);
      rollbackError = 'The deliberate invalid-provider write unexpectedly succeeded; rollback was not demonstrated.';
    } catch (error) {
      rollbackError = String(error?.message || error);
    }

    const invoice = await env.DB.prepare(
      'SELECT status,provider_id,provider_reference FROM sponsor_invoices WHERE invoice_id=? LIMIT 1'
    ).bind(invoiceId).first();
    const partnershipState = await env.DB.prepare(
      'SELECT payment_status,payment_provider_id,payment_reference FROM sponsor_partnerships WHERE id=? LIMIT 1'
    ).bind(partnership.id).first();
    const receiptCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM payment_receipts WHERE invoice_id=?'
    ).bind(invoiceId).first();
    const activityCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM sponsor_activities WHERE partnership_id=? AND summary=?'
    ).bind(partnership.id, summary).first();

    checks = {
      syntheticInvoiceRemainsIssued: invoice?.status === 'issued' && invoice?.provider_id === 'unconfigured' && !invoice?.provider_reference,
      syntheticPartnershipRemainsUnpaid: partnershipState?.payment_status === 'invoice_sent' &&
        partnershipState?.payment_provider_id === 'unconfigured' && !partnershipState?.payment_reference,
      noReceiptWasCommitted: Number(receiptCount?.count || 0) === 0,
      noActivityWasCommitted: Number(activityCount?.count || 0) === 0
    };
  } catch (error) {
    rollbackError = String(error?.message || error);
  } finally {
    try {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sponsor_invoices WHERE invoice_id=?').bind(invoiceId),
        env.DB.prepare('DELETE FROM sponsor_partnerships WHERE application_id=(SELECT id FROM opportunity_applications WHERE email=?)').bind(email),
        env.DB.prepare('DELETE FROM opportunity_applications WHERE email=?').bind(email)
      ]);
      cleanupComplete = true;
    } catch (error) {
      rollbackError = (rollbackError ? rollbackError + '; ' : '') + 'Synthetic cleanup failed: ' + String(error?.message || error);
    }
  }

  const passed = setupComplete && !!checks && Object.values(checks).every(Boolean) && cleanupComplete &&
    rollbackError && rollbackError !== 'The deliberate invalid-provider write unexpectedly succeeded; rollback was not demonstrated.';
  return json({
    test: 'DHF Preview D1 batch rollback failure-injection',
    result: passed ? 'PASS' : 'FAIL',
    scope: 'Preview D1 only',
    deliberateFailureObserved: !!rollbackError && rollbackError !== 'The deliberate invalid-provider write unexpectedly succeeded; rollback was not demonstrated.',
    checks,
    syntheticRecordsCreated: setupComplete,
    syntheticRecordsCleanedUp: cleanupComplete,
    note: 'No payment flags were enabled. No customer payment or receipt email was initiated.',
    ...(passed ? {} : { diagnostic: rollbackError || 'Rollback checks did not all pass.' })
  }, passed ? 200 : 500);
}
