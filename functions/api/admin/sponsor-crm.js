import { hashInvoiceToken } from '../../lib/invoices.js';
import { getPaymentProviderConfig, resolvePaymentProvider, createStripeInvoiceAdapter } from '../../lib/payment-provider.js';
import { createPaidReceipt } from '../../lib/payment-receipts.js';
import { sendReceiptEmail } from '../../lib/receipt-email.js';
const DIVISIONS = new Set(['business_network','summits_events','marketplace','academy','land_experiences','advertising_media']);
const STAGES = new Set(['prospect','qualified','proposal_draft','proposal_sent','negotiating','contracted','fulfilling','completed','renewal_due','closed_lost']);
const CONTRACT_STATES = new Set(['not_started','draft','sent','signed','declined']);
const DELIVERABLE_STATES = new Set(['planned','in_progress','completed','waived']);
const ACTIVITY_TYPES = new Set(['note','email','call','meeting','proposal','contract','payment','follow_up']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === new URL(request.url).origin;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === new URL(request.url).origin; } catch { return false; }
}
function text(value, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function cents(value, optional = true) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 100 && n <= 100000000 ? n : NaN;
}
function dateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const parsed = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s ? s : NaN;
}

function assertStripeKeyMode(env) {
  const expected = env.DHF_STRIPE_EXPECT_LIVEMODE;
  const key = typeof env.STRIPE_SECRET_KEY === 'string' ? env.STRIPE_SECRET_KEY : '';
  const match = key.match(/^(?:sk|rk)_(test|live)_/);
  if (!['true', 'false'].includes(expected) || !match || match[1] !== (expected === 'true' ? 'live' : 'test')) {
    throw new Error('Stripe API key mode does not match this environment.');
  }
}

async function stripeRequest(path, env, method = 'GET', params = null, idempotencyKey = '') {
  assertStripeKeyMode(env);
  const headers = { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY };
  const init = { method, headers };
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = params.toString();
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.stripe.com/v1/' + path, init);
  const result = await response.json();
  if (!response.ok) {
    const message = result.error?.message || 'Stripe invoice request failed.';
    throw new Error(message);
  }
  return result;
}

function safeHttpsUrl(value) {
  const s = text(value, 1000);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}

export async function onRequestGet({ env }) {
  try {
    const applications = await env.DB.prepare(
      "SELECT a.id, a.name, a.email, a.organization, a.website, a.city, a.region, a.country, a.category, a.requested_package, a.event_interest, a.message, a.status, a.created_at FROM opportunity_applications a LEFT JOIN sponsor_partnerships s ON s.application_id = a.id WHERE a.application_type = 'sponsor' AND s.id IS NULL ORDER BY a.created_at DESC LIMIT 200"
    ).all();
    const partnerships = await env.DB.prepare(
      "SELECT s.*, a.name AS contact_name, a.email AS contact_email, a.organization, a.website, a.city, a.region, a.country, a.category, a.requested_package AS inquiry_package, a.event_interest, a.status AS application_status, (SELECT i.due_date FROM sponsor_invoices i WHERE i.partnership_id = s.id ORDER BY i.created_at DESC LIMIT 1) AS invoice_due_date, (SELECT i.invoice_number FROM sponsor_invoices i WHERE i.partnership_id = s.id ORDER BY i.created_at DESC LIMIT 1) AS invoice_number, (SELECT i.invoice_pdf_url FROM sponsor_invoices i WHERE i.partnership_id = s.id ORDER BY i.created_at DESC LIMIT 1) AS invoice_pdf_url, (SELECT i.provider_status FROM sponsor_invoices i WHERE i.partnership_id = s.id ORDER BY i.created_at DESC LIMIT 1) AS provider_invoice_status FROM sponsor_partnerships s JOIN opportunity_applications a ON a.id = s.application_id ORDER BY s.updated_at DESC LIMIT 200"
    ).all();
    const deliverables = await env.DB.prepare(
      "SELECT d.* FROM sponsor_deliverables d JOIN sponsor_partnerships s ON s.id = d.partnership_id ORDER BY CASE d.status WHEN 'completed' THEN 1 ELSE 0 END, d.due_date IS NULL, d.due_date ASC, d.id DESC LIMIT 500"
    ).all();
    const activities = await env.DB.prepare(
      "SELECT x.* FROM sponsor_activities x JOIN sponsor_partnerships s ON s.id = x.partnership_id ORDER BY x.created_at DESC LIMIT 500"
    ).all();
    return json({
      applications: applications.results || [],
      partnerships: partnerships.results || [],
      deliverables: deliverables.results || [],
      activities: activities.results || [],
      invoice_issuing_enabled: (() => { const config = getPaymentProviderConfig(env); return config.invoicingEnabled && config.provider === 'stripe' && Boolean(env.STRIPE_SECRET_KEY); })(),
      payment_provider: getPaymentProviderConfig(env).provider,
      payment_methods: getPaymentProviderConfig(env).methods
    });
  } catch (error) {
    console.error('Sponsor CRM read failed:', error?.message || String(error));
    return json({ error: 'Sponsor records are temporarily unavailable.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid request.' }, 400);
  const action = text(data.action, 40);

  try {
    if (action === 'create') {
      const applicationId = Number(data.application_id);
      const division = text(data.division, 40) || 'business_network';
      const packageName = text(data.package_name, 160);
      const proposed = cents(data.proposed_amount_cents);
      if (!Number.isSafeInteger(applicationId) || applicationId < 1) return json({ error: 'Valid sponsor application is required.' }, 422);
      if (!DIVISIONS.has(division)) return json({ error: 'Invalid sponsor division.' }, 422);
      if (Number.isNaN(proposed)) return json({ error: 'Proposed amount must be between $1 and $1,000,000.' }, 422);
      const application = await env.DB.prepare('SELECT id, application_type, status FROM opportunity_applications WHERE id = ?').bind(applicationId).first();
      if (!application || application.application_type !== 'sponsor') return json({ error: 'Sponsor application not found.' }, 404);
      if (application.status === 'declined') return json({ error: 'A declined sponsor inquiry cannot be moved into the active pipeline.' }, 409);
      const result = await env.DB.prepare(
        "INSERT OR IGNORE INTO sponsor_partnerships (application_id, division, package_name, proposed_amount_cents) VALUES (?, ?, ?, ?)"
      ).bind(applicationId, division, packageName, proposed).run();
      const partnership = await env.DB.prepare('SELECT id, application_id, stage FROM sponsor_partnerships WHERE application_id = ?').bind(applicationId).first();
      await env.DB.prepare("UPDATE opportunity_applications SET status = 'reviewing', updated_at = datetime('now') WHERE id = ? AND status = 'new'").bind(applicationId).run();
      return json({ success: true, created: Number(result.meta?.changes || 0) > 0, partnership });
    }

    if (action === 'update') {
      if (Object.prototype.hasOwnProperty.call(data, 'payment_status') || Object.prototype.hasOwnProperty.call(data, 'invoice_url')) return json({ error: 'Payment status and provider invoice links are system-managed.' }, 422);
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Valid partnership ID is required.' }, 422);
      const stage = text(data.stage, 40);
      const division = text(data.division, 40);
      const contractStatus = text(data.contract_status, 40);
      const packageName = text(data.package_name, 160);
      const proposed = cents(data.proposed_amount_cents);
      const agreed = cents(data.agreed_amount_cents);
      const contractUrl = safeHttpsUrl(data.contract_url);
      const startDate = dateOrNull(data.start_date);
      const endDate = dateOrNull(data.end_date);
      const renewalDate = dateOrNull(data.renewal_date);
      const contractSignedAt = dateOrNull(data.contract_signed_at);
      const notes = text(data.notes, 5000);
      if (!STAGES.has(stage)) return json({ error: 'Invalid partnership stage.' }, 422);
      if (!DIVISIONS.has(division)) return json({ error: 'Invalid sponsor division.' }, 422);
      if (!CONTRACT_STATES.has(contractStatus)) return json({ error: 'Invalid agreement status.' }, 422);
      if (Number.isNaN(proposed) || Number.isNaN(agreed)) return json({ error: 'Amounts must be between $1 and $1,000,000.' }, 422);
      if (contractUrl === null) return json({ error: 'Agreement links must use HTTPS.' }, 422);
      if (Number.isNaN(startDate) || Number.isNaN(endDate) || Number.isNaN(renewalDate) || Number.isNaN(contractSignedAt)) return json({ error: 'Dates must use YYYY-MM-DD.' }, 422);
      if (endDate && startDate && endDate < startDate) return json({ error: 'End date cannot precede start date.' }, 422);
      if (contractStatus === 'signed' && (!contractUrl || !contractSignedAt)) return json({ error: 'A signed agreement requires a secure document link and signed date.' }, 422);
      if (stage === 'contracted' && contractStatus !== 'signed') return json({ error: 'A partnership cannot be marked contracted until the agreement is recorded as signed.' }, 409);
      if (['fulfilling','completed','renewal_due'].includes(stage) && (contractStatus !== 'signed' || !Number.isSafeInteger(agreed))) return json({ error: 'Fulfillment and renewal require a signed agreement and agreed amount.' }, 409);
      const existing = await env.DB.prepare('SELECT id FROM sponsor_partnerships WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Partnership not found.' }, 404);
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET stage = ?, division = ?, package_name = ?, proposed_amount_cents = ?, agreed_amount_cents = ?, contract_status = ?, contract_url = ?, contract_signed_at = ?, start_date = ?, end_date = ?, renewal_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(stage, division, packageName, proposed, agreed, contractStatus, contractUrl, contractSignedAt, startDate, endDate, renewalDate, notes, id).run();
      return json({ success: true, partnership_id: id });
    }

    if (action === 'add_deliverable') {
      const partnershipId = Number(data.partnership_id);
      const title = text(data.title, 180);
      const description = text(data.description, 2000);
      const dueDate = dateOrNull(data.due_date);
      if (!Number.isSafeInteger(partnershipId) || partnershipId < 1 || !title) return json({ error: 'Partnership and deliverable title are required.' }, 422);
      if (Number.isNaN(dueDate)) return json({ error: 'Due date must use YYYY-MM-DD.' }, 422);
      if (dueDate && dueDate < new Date().toISOString().slice(0, 10)) return json({ error: 'Deliverable due date cannot be in the past.' }, 422);
      const exists = await env.DB.prepare('SELECT id FROM sponsor_partnerships WHERE id = ?').bind(partnershipId).first();
      if (!exists) return json({ error: 'Partnership not found.' }, 404);
      const result = await env.DB.prepare(
        "INSERT INTO sponsor_deliverables (partnership_id, title, description, due_date) VALUES (?, ?, ?, ?)"
      ).bind(partnershipId, title, description, dueDate).run();
      return json({ success: true, deliverable_id: result.meta?.last_row_id || null });
    }

    if (action === 'update_deliverable') {
      const id = Number(data.id);
      const status = text(data.status, 30);
      const evidenceUrl = safeHttpsUrl(data.evidence_url);
      if (!Number.isSafeInteger(id) || id < 1 || !DELIVERABLE_STATES.has(status)) return json({ error: 'Valid deliverable and status are required.' }, 422);
      if (evidenceUrl === null) return json({ error: 'Evidence link must use HTTPS.' }, 422);
      const exists = await env.DB.prepare('SELECT id FROM sponsor_deliverables WHERE id = ?').bind(id).first();
      if (!exists) return json({ error: 'Deliverable not found.' }, 404);
      await env.DB.prepare(
        "UPDATE sponsor_deliverables SET status = ?, evidence_url = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, datetime('now')) ELSE NULL END, updated_at = datetime('now') WHERE id = ?"
      ).bind(status, evidenceUrl, status, id).run();
      return json({ success: true, deliverable_id: id, status });
    }

    if (action === 'add_activity') {
      const partnershipId = Number(data.partnership_id);
      const activityType = text(data.activity_type, 30);
      const summary = text(data.summary, 2000);
      const followUp = dateOrNull(data.follow_up_at);
      if (!Number.isSafeInteger(partnershipId) || partnershipId < 1 || !ACTIVITY_TYPES.has(activityType) || !summary) return json({ error: 'Partnership, activity type and summary are required.' }, 422);
      if (Number.isNaN(followUp)) return json({ error: 'Follow-up date must use YYYY-MM-DD.' }, 422);
      const exists = await env.DB.prepare('SELECT id FROM sponsor_partnerships WHERE id = ?').bind(partnershipId).first();
      if (!exists) return json({ error: 'Partnership not found.' }, 404);
      const result = await env.DB.prepare(
        'INSERT INTO sponsor_activities (partnership_id, activity_type, summary, follow_up_at) VALUES (?, ?, ?, ?)'
      ).bind(partnershipId, activityType, summary, followUp).run();
      return json({ success: true, activity_id: result.meta?.last_row_id || null });
    }

    if (action === 'create_invoice') {
      const paymentConfig = getPaymentProviderConfig(env);
      if (!paymentConfig.invoicingEnabled) return json({ error: 'Sponsor invoice issuing is disabled. Payment activation requires an explicitly selected provider and owner-approved configuration.' }, 503);
      if (paymentConfig.provider !== 'stripe') return json({ error: 'The selected payment provider does not yet have an invoice adapter connected.' }, 503);
      if (!env.STRIPE_SECRET_KEY) return json({ error: 'The selected payment provider is not configured in this environment.' }, 503);
      const paymentProvider = resolvePaymentProvider(env, { stripe: createStripeInvoiceAdapter(env) });
      if (!paymentProvider) return json({ error: 'The selected provider adapter is not ready. Invoice issuing remains disabled.' }, 503);
      const partnershipId = Number(data.partnership_id);
      const dueDate = dateOrNull(data.due_date);
      if (!Number.isSafeInteger(partnershipId) || partnershipId < 1) return json({ error: 'Valid partnership ID is required.' }, 422);
      if (!dueDate || Number.isNaN(dueDate)) return json({ error: 'Choose an invoice due date.' }, 422);
      if (dueDate < new Date().toISOString().slice(0, 10)) return json({ error: 'Invoice due date cannot be in the past.' }, 422);

      const partnership = await env.DB.prepare(
        "SELECT s.*, a.id AS application_id, a.organization, a.name AS contact_name, a.email AS contact_email FROM sponsor_partnerships s JOIN opportunity_applications a ON a.id = s.application_id WHERE s.id = ?"
      ).bind(partnershipId).first();
      if (!partnership) return json({ error: 'Partnership not found.' }, 404);
      if (partnership.payment_status === 'paid' || partnership.payment_status === 'refunded') return json({ error: 'This partnership has already been paid or refunded.' }, 409);
      if (partnership.contract_status !== 'signed' || !['contracted','fulfilling','completed','renewal_due'].includes(partnership.stage) || !Number.isSafeInteger(Number(partnership.agreed_amount_cents)) || Number(partnership.agreed_amount_cents) < 100) {
        return json({ error: 'A signed agreement, contracted partnership stage and agreed amount are required before issuing an invoice.' }, 409);
      }
      if (!partnership.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnership.contact_email)) return json({ error: 'A valid sponsor billing email is required on the application.' }, 422);
      try { assertStripeKeyMode(env); }
      catch { return json({ error: 'Stripe test/live API-key mode does not match this environment. Invoice creation blocked.' }, 503); }

      const openInvoice = await env.DB.prepare(
        "SELECT * FROM sponsor_invoices WHERE partnership_id = ? AND status IN ('issued','pending') ORDER BY created_at DESC LIMIT 1"
      ).bind(partnershipId).first();
      if (openInvoice?.status === 'paid') return json({ error: 'This partnership is already paid.' }, 409);
      let invoiceRecord = openInvoice;
      let invoiceId = openInvoice?.invoice_id || crypto.randomUUID();
      const amount = Number(partnership.agreed_amount_cents);
      if (openInvoice && (Number(openInvoice.amount_cents) !== amount || openInvoice.due_date !== dueDate)) return json({ error: 'An existing invoice has a different amount or due date. Void it with the payment provider before issuing a replacement.' }, 409);
      if (!['true','false'].includes(env.DHF_STRIPE_EXPECT_LIVEMODE)) return json({ error: 'Expected Stripe test/live mode is not configured.' }, 503);
      let stripeAccount;
      try { stripeAccount = await stripeRequest('account', env); }
      catch { return json({ error: 'Stripe account mode could not be verified.' }, 503); }
      if (stripeAccount.livemode !== (env.DHF_STRIPE_EXPECT_LIVEMODE === 'true')) return json({ error: 'Stripe key mode does not match this environment. Invoice creation blocked.' }, 409);
      const description = 'Da HoodFarmer — ' + (text(partnership.package_name, 160) || 'Sponsorship partnership');
      const dueTimestamp = Math.floor(Date.parse(dueDate + 'T23:59:59Z') / 1000);
      if (!invoiceRecord) {
        const tokenHash = await hashInvoiceToken(invoiceId);
        await env.DB.prepare(
          "INSERT INTO sponsor_invoices (invoice_id, partnership_id, amount_cents, currency, description, due_date, status, token_hash, stripe_status, provider_id, provider_status) VALUES (?, ?, ?, 'usd', ?, ?, 'pending', ?, 'draft', 'stripe', 'draft')"
        ).bind(invoiceId, partnershipId, amount, description, dueDate, tokenHash).run();
        invoiceRecord = { invoice_id: invoiceId, status: 'pending', stripe_status: 'draft', stripe_invoice_id: null };
      }

      try {
        let customerId = partnership.provider_customer_id || partnership.stripe_customer_id || '';
        if (!customerId) {
          const customerParams = new URLSearchParams();
          customerParams.set('email', partnership.contact_email);
          customerParams.set('name', text(partnership.organization || partnership.contact_name, 160));
          customerParams.set('metadata[dhf_partnership_id]', String(partnershipId));
          customerParams.set('metadata[dhf_application_id]', String(partnership.application_id));
          customerParams.set('metadata[dhf_brand]', 'Da HoodFarmer');
          const customer = await stripeRequest('customers', env, 'POST', customerParams, 'dhf-customer-' + partnershipId);
          customerId = customer.id;
          await env.DB.prepare("UPDATE sponsor_partnerships SET stripe_customer_id = ?, provider_customer_id = ?, payment_provider_id = 'stripe', updated_at = datetime('now') WHERE id = ?")
            .bind(customerId, customerId, partnershipId).run();
        }

        let stripeInvoice = null;
        if (invoiceRecord.stripe_invoice_id) {
          stripeInvoice = await paymentProvider.retrieveInvoice(invoiceRecord.stripe_invoice_id);
        } else {
          const invoiceParams = new URLSearchParams();
          invoiceParams.set('customer', customerId);
          invoiceParams.set('collection_method', 'send_invoice');
          invoiceParams.set('due_date', String(dueTimestamp));
          invoiceParams.set('auto_advance', 'false');
          invoiceParams.set('pending_invoice_items_behavior', 'exclude');
          invoiceParams.set('description', description);
          invoiceParams.set('metadata[dhf_invoice_id]', invoiceId);
          invoiceParams.set('metadata[dhf_partnership_id]', String(partnershipId));
          invoiceParams.set('metadata[dhf_application_id]', String(partnership.application_id));
          invoiceParams.set('metadata[dhf_brand]', 'Da HoodFarmer');
          stripeInvoice = await paymentProvider.createInvoice({ params: invoiceParams, idempotencyKey: 'dhf-invoice-' + invoiceId });
          await env.DB.prepare("UPDATE sponsor_invoices SET stripe_invoice_id = ?, stripe_status = ?, provider_id = 'stripe', provider_invoice_id = ?, provider_status = ?, updated_at = datetime('now') WHERE invoice_id = ?")
            .bind(stripeInvoice.id, stripeInvoice.status || 'draft', stripeInvoice.id, stripeInvoice.status || 'draft', invoiceId).run();
        }

        if (stripeInvoice.status === 'paid') {
          const paidAmount = Number(stripeInvoice.amount_paid);
          if (!Number.isSafeInteger(paidAmount) || paidAmount !== amount) {
            return json({ error: 'The provider reports a paid invoice, but its paid amount does not match the approved agreement. Owner reconciliation is required.' }, 409);
          }
          const receipt = await createPaidReceipt({
            DB: env.DB, env, invoiceId, providerId: 'stripe',
            providerReference: typeof stripeInvoice.payment_intent === 'string' ? stripeInvoice.payment_intent : stripeInvoice.id,
            amountCents: paidAmount, currency: stripeInvoice.currency || 'usd',
            paidAt: stripeInvoice.status_transitions?.paid_at ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString() : new Date().toISOString(),
            paymentMethod: null
          });
          await env.DB.prepare("UPDATE sponsor_invoices SET status = 'paid', stripe_status = 'paid', provider_id = 'stripe', provider_invoice_id = ?, provider_status = 'paid', hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE invoice_id = ?").bind(stripeInvoice.id, stripeInvoice.hosted_invoice_url || '', stripeInvoice.invoice_pdf || '', stripeInvoice.number || '', invoiceId).run();
          await env.DB.prepare("UPDATE sponsor_partnerships SET payment_status = 'paid', payment_provider_id = 'stripe', payment_reference = ?, invoice_url = ?, updated_at = datetime('now') WHERE id = ?").bind(stripeInvoice.id, stripeInvoice.hosted_invoice_url || '', partnershipId).run();
          await sendReceiptEmail({ DB: env.DB, env, receipt });
          return json({ success: true, invoice_id: invoiceId, stripe_invoice_id: stripeInvoice.id, invoice_number: stripeInvoice.number || '', invoice_url: stripeInvoice.hosted_invoice_url || '', amount_cents: amount, due_date: dueDate, payment_status: 'paid', receipt_id: receipt.receipt_id });
        }
        if (stripeInvoice.status === 'void' || stripeInvoice.status === 'uncollectible') return json({ error: 'The existing Stripe invoice is void or uncollectible. Review it in Stripe before issuing a replacement.' }, 409);
        if (stripeInvoice.status !== 'draft' && Number(stripeInvoice.amount_due) !== amount) throw new Error('Existing Stripe invoice amount does not match the approved amount.');
        if (stripeInvoice.status === 'draft') {
          const itemParams = new URLSearchParams();
          itemParams.set('customer', customerId);
          itemParams.set('invoice', stripeInvoice.id);
          itemParams.set('amount', String(amount));
          itemParams.set('currency', 'usd');
          itemParams.set('description', description);
          itemParams.set('metadata[dhf_invoice_id]', invoiceId);
          itemParams.set('metadata[dhf_partnership_id]', String(partnershipId));
          await stripeRequest('invoiceitems', env, 'POST', itemParams, 'dhf-invoice-item-' + invoiceId);
          stripeInvoice = await stripeRequest('invoices/' + encodeURIComponent(stripeInvoice.id) + '/finalize', env, 'POST', new URLSearchParams({ auto_advance: 'false' }), 'dhf-finalize-' + invoiceId);
        }

        if (!stripeInvoice.hosted_invoice_url) {
          stripeInvoice = await stripeRequest('invoices/' + encodeURIComponent(stripeInvoice.id), env);
        }
        if (!stripeInvoice.hosted_invoice_url) throw new Error('Stripe finalized the invoice but did not return a hosted invoice URL.');
        if (Number(stripeInvoice.amount_due) !== amount) throw new Error('Finalized Stripe invoice amount does not match the approved amount.');
        await env.DB.prepare(
          "UPDATE sponsor_invoices SET status = CASE WHEN status IN ('paid','void') THEN status ELSE 'issued' END, stripe_status = ?, provider_id = 'stripe', provider_invoice_id = ?, provider_status = ?, hosted_invoice_url = ?, invoice_pdf_url = ?, invoice_number = ?, due_date = ?, updated_at = datetime('now') WHERE invoice_id = ?"
        ).bind(stripeInvoice.status || 'open', stripeInvoice.id, stripeInvoice.status || 'open', stripeInvoice.hosted_invoice_url, stripeInvoice.invoice_pdf || '', stripeInvoice.number || '', dueDate, invoiceId).run();
        await env.DB.prepare(
          "UPDATE sponsor_partnerships SET payment_status = CASE WHEN payment_status IN ('paid','failed','refunded') THEN payment_status ELSE 'invoice_sent' END, payment_provider_id = 'stripe', invoice_url = ?, payment_reference = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(stripeInvoice.hosted_invoice_url, stripeInvoice.id, partnershipId).run();
        await env.DB.prepare(
          "INSERT INTO sponsor_activities (partnership_id, activity_type, summary) VALUES (?, 'payment', ?)"
        ).bind(partnershipId, 'Stripe invoice ' + (stripeInvoice.number || stripeInvoice.id) + ' finalized; hosted invoice link is ready for the owner to share.').run();
        return json({ success: true, invoice_id: invoiceId, stripe_invoice_id: stripeInvoice.id, invoice_number: stripeInvoice.number || '', invoice_url: stripeInvoice.hosted_invoice_url, invoice_pdf_url: stripeInvoice.invoice_pdf || '', amount_cents: amount, due_date: dueDate });
      } catch (error) {
        console.error('Stripe sponsor invoice creation failed:', error?.message || String(error));
        return json({ error: 'The invoice could not be finalized. The CRM retained the draft record; retry the invoice action or review Stripe before issuing another.' }, 502);
      }
    }

    return json({ error: 'Unknown sponsor CRM action.' }, 400);
  } catch (error) {
    console.error('Sponsor CRM write failed:', error?.message || String(error));
    return json({ error: 'Sponsor record could not be saved.' }, 500);
  }
}
