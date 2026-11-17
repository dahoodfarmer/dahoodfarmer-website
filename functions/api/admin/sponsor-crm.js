import { hashInvoiceToken } from '../../lib/invoices.js';
const DIVISIONS = new Set(['business_network','summits_events','marketplace','academy','land_experiences','advertising_media']);
const STAGES = new Set(['prospect','qualified','proposal_draft','proposal_sent','negotiating','contracted','fulfilling','completed','renewal_due','closed_lost']);
const CONTRACT_STATES = new Set(['not_started','draft','sent','signed','declined']);
const PAYMENT_STATES = new Set(['not_requested','invoice_sent','pending','failed']);
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
      "SELECT s.*, a.name AS contact_name, a.email AS contact_email, a.organization, a.website, a.city, a.region, a.country, a.category, a.requested_package AS inquiry_package, a.event_interest, a.status AS application_status FROM sponsor_partnerships s JOIN opportunity_applications a ON a.id = s.application_id ORDER BY s.updated_at DESC LIMIT 200"
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
      activities: activities.results || []
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
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Valid partnership ID is required.' }, 422);
      const stage = text(data.stage, 40);
      const division = text(data.division, 40);
      const contractStatus = text(data.contract_status, 40);
      const paymentStatus = text(data.payment_status, 40);
      const packageName = text(data.package_name, 160);
      const proposed = cents(data.proposed_amount_cents);
      const agreed = cents(data.agreed_amount_cents);
      const contractUrl = safeHttpsUrl(data.contract_url);
      const invoiceUrl = safeHttpsUrl(data.invoice_url);
      const startDate = dateOrNull(data.start_date);
      const endDate = dateOrNull(data.end_date);
      const renewalDate = dateOrNull(data.renewal_date);
      const contractSignedAt = dateOrNull(data.contract_signed_at);
      const notes = text(data.notes, 5000);
      if (!STAGES.has(stage)) return json({ error: 'Invalid partnership stage.' }, 422);
      if (!DIVISIONS.has(division)) return json({ error: 'Invalid sponsor division.' }, 422);
      if (!CONTRACT_STATES.has(contractStatus)) return json({ error: 'Invalid agreement status.' }, 422);
      if (!PAYMENT_STATES.has(paymentStatus)) return json({ error: 'Payment status cannot be manually marked paid or refunded. It must be reconciled against a payment record.' }, 422);
      if (Number.isNaN(proposed) || Number.isNaN(agreed)) return json({ error: 'Amounts must be between $1 and $1,000,000.' }, 422);
      if (contractUrl === null || invoiceUrl === null) return json({ error: 'Agreement and invoice links must use HTTPS.' }, 422);
      if (Number.isNaN(startDate) || Number.isNaN(endDate) || Number.isNaN(renewalDate) || Number.isNaN(contractSignedAt)) return json({ error: 'Dates must use YYYY-MM-DD.' }, 422);
      if (endDate && startDate && endDate < startDate) return json({ error: 'End date cannot precede start date.' }, 422);
      if (contractStatus === 'signed' && (!contractUrl || !contractSignedAt)) return json({ error: 'A signed agreement requires a secure document link and signed date.' }, 422);
      if (stage === 'contracted' && contractStatus !== 'signed') return json({ error: 'A partnership cannot be marked contracted until the agreement is recorded as signed.' }, 409);
      if (['fulfilling','completed','renewal_due'].includes(stage) && (contractStatus !== 'signed' || !Number.isSafeInteger(agreed))) return json({ error: 'Fulfillment and renewal require a signed agreement and agreed amount.' }, 409);
      if (paymentStatus === 'invoice_sent' && !invoiceUrl) return json({ error: 'An invoice link is required before marking an invoice sent.' }, 422);
      const existing = await env.DB.prepare('SELECT id FROM sponsor_partnerships WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Partnership not found.' }, 404);
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET stage = ?, division = ?, package_name = ?, proposed_amount_cents = ?, agreed_amount_cents = ?, contract_status = ?, contract_url = ?, contract_signed_at = ?, payment_status = ?, invoice_url = ?, start_date = ?, end_date = ?, renewal_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(stage, division, packageName, proposed, agreed, contractStatus, contractUrl, contractSignedAt, paymentStatus, invoiceUrl, startDate, endDate, renewalDate, notes, id).run();
      return json({ success: true, partnership_id: id });
    }

    if (action === 'add_deliverable') {
      const partnershipId = Number(data.partnership_id);
      const title = text(data.title, 180);
      const description = text(data.description, 2000);
      const dueDate = dateOrNull(data.due_date);
      if (!Number.isSafeInteger(partnershipId) || partnershipId < 1 || !title) return json({ error: 'Partnership and deliverable title are required.' }, 422);
      if (Number.isNaN(dueDate)) return json({ error: 'Due date must use YYYY-MM-DD.' }, 422);
      if (dueDate && dueDate < new Date().toISOString().slice(0, 10)) return json({ error: 'Invoice due date cannot be in the past.' }, 422);
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
      const partnershipId = Number(data.partnership_id);
      const dueDate = dateOrNull(data.due_date);
      if (!Number.isSafeInteger(partnershipId) || partnershipId < 1) return json({ error: 'Valid partnership ID is required.' }, 422);
      if (Number.isNaN(dueDate)) return json({ error: 'Due date must use YYYY-MM-DD.' }, 422);
      const partnership = await env.DB.prepare(
        "SELECT s.*, a.organization FROM sponsor_partnerships s JOIN opportunity_applications a ON a.id = s.application_id WHERE s.id = ?"
      ).bind(partnershipId).first();
      if (!partnership) return json({ error: 'Partnership not found.' }, 404);
      if (partnership.contract_status !== 'signed' || !['contracted','fulfilling','completed','renewal_due'].includes(partnership.stage) || !Number.isSafeInteger(Number(partnership.agreed_amount_cents)) || Number(partnership.agreed_amount_cents) < 100) {
        return json({ error: 'A signed agreement, contracted partnership stage and agreed amount are required before issuing an invoice.' }, 409);
      }
      if (partnership.payment_status === 'paid') return json({ error: 'This partnership is already marked paid.' }, 409);
      const openInvoice = await env.DB.prepare(
        "SELECT invoice_id FROM sponsor_invoices WHERE partnership_id = ? AND status IN ('issued','pending') ORDER BY created_at DESC LIMIT 1"
      ).bind(partnershipId).first();
      if (openInvoice) return json({ error: 'An unpaid invoice already exists for this partnership. Use the saved invoice link or void it before issuing another.' }, 409);
      const invoiceId = crypto.randomUUID();
      const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const tokenHash = await hashInvoiceToken(token);
      const amount = Number(partnership.agreed_amount_cents);
      const description = 'Da HoodFarmer — ' + (text(partnership.package_name, 160) || 'Sponsorship partnership');
      await env.DB.prepare(
        "INSERT INTO sponsor_invoices (invoice_id, partnership_id, amount_cents, currency, description, due_date, status, token_hash) VALUES (?, ?, ?, 'usd', ?, ?, 'issued', ?)"
      ).bind(invoiceId, partnershipId, amount, description, dueDate, tokenHash).run();
      const invoiceUrl = new URL('/pay/invoice?token=' + encodeURIComponent(token), request.url).toString();
      await env.DB.prepare(
        "UPDATE sponsor_partnerships SET payment_status = 'invoice_sent', invoice_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(invoiceUrl, partnershipId).run();
      await env.DB.prepare(
        "INSERT INTO sponsor_activities (partnership_id, activity_type, summary) VALUES (?, 'payment', ?)"
      ).bind(partnershipId, 'Invoice ' + invoiceId + ' issued for ' + amount + ' cents.').run();
      return json({ success: true, invoice_id: invoiceId, invoice_url: invoiceUrl, amount_cents: amount, due_date: dueDate });
    }

    return json({ error: 'Unknown sponsor CRM action.' }, 400);
  } catch (error) {
    console.error('Sponsor CRM write failed:', error?.message || String(error));
    return json({ error: 'Sponsor record could not be saved.' }, 500);
  }
}
