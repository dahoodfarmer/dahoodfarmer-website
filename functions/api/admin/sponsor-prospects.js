import { isValidEmail, isValidPayload, sanitizeString } from '../../lib/validation.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const TYPES = new Set(['local_business','corporate_sponsor','media_production','network_development','distribution','industry_association','funding','service_provider']);
const DIVISIONS = new Set(['business_network','summits_events','marketplace','academy','land_experiences','media','cross_division']);
const STAGES = new Set(['research','qualified','contact_route_verified','owner_approved','contacted','responded','discovery','proposal','negotiating','contracted','nurture','closed_won','closed_lost']);
const ACTIVITIES = new Set(['research','qualification','approval','outreach','response','meeting','proposal','contract','note']);
const CONTACTED_STAGES = new Set(['contacted','responded','discovery','proposal','negotiating','contracted','closed_won']);

function text(value, max = 500) { return sanitizeString(value, max); }
function dateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : NaN;
}
function safeUrl(value) {
  const s = text(value, 1000);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
function cents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : NaN;
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'Prospect records are unavailable.' }, 503);
  try {
    const [prospects, activities] = await Promise.all([
      env.DB.prepare('SELECT * FROM sponsor_prospects ORDER BY fit_score DESC, updated_at DESC LIMIT 500').all(),
      env.DB.prepare('SELECT a.*, p.organization FROM sponsor_prospect_activities a JOIN sponsor_prospects p ON p.id = a.prospect_id ORDER BY a.created_at DESC LIMIT 200').all()
    ]);
    return json({ prospects: prospects.results || [], activities: activities.results || [] });
  } catch (error) {
    console.error('Sponsor prospect CRM read failed:', error?.message || String(error));
    return json({ error: 'Prospect records could not be loaded.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'Prospect records are unavailable.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Cross-origin prospect CRM write rejected.' }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request.' }, 400);
  const action = text(data.action, 40);

  try {
    if (action === 'add') {
      const organization = text(data.organization, 180);
      const partnerType = text(data.partner_type, 40);
      const division = text(data.division, 40);
      const website = safeUrl(data.website);
      const sourceUrl = safeUrl(data.source_url);
      const fitScore = Number(data.fit_score ?? 0);
      const value = cents(data.estimated_value_cents);
      const followUp = dateOrNull(data.next_follow_up_date);
      if (!organization) return json({ error: 'Organization name is required.' }, 422);
      if (!TYPES.has(partnerType) || !DIVISIONS.has(division)) return json({ error: 'Choose a valid partner type and division.' }, 422);
      if (website === null || sourceUrl === null) return json({ error: 'Website and source links must use HTTPS.' }, 422);
      const publicEmail = text(data.public_email, 254).toLowerCase();
      if (publicEmail && !isValidEmail(publicEmail)) return json({ error: 'Public email must be valid.' }, 422);
      if (!Number.isInteger(fitScore) || fitScore < 0 || fitScore > 10 || Number.isNaN(value) || Number.isNaN(followUp)) return json({ error: 'Fit score, value or follow-up date is invalid.' }, 422);
      const slug = text(data.slug, 100).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'prospect-' + crypto.randomUUID().slice(0, 8);
      const result = await env.DB.prepare(
        "INSERT INTO sponsor_prospects (slug, organization, partner_type, division, category, location, website, source_url, contact_route, public_phone, public_email, contact_name, fit_score, stage, estimated_value_cents, next_follow_up_date, qualification_notes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'research', ?, ?, ?, ?)"
      ).bind(slug, organization, partnerType, division, text(data.category, 120), text(data.location, 180), website, sourceUrl, text(data.contact_route, 500), text(data.public_phone, 80), publicEmail, text(data.contact_name, 120), fitScore, value, followUp, text(data.qualification_notes, 2000), text(data.notes, 3000)).run();
      const id = result.meta?.last_row_id;
      if (id) await env.DB.prepare("INSERT INTO sponsor_prospect_activities (prospect_id, activity_type, summary) VALUES (?, 'research', 'Prospect added to internal research queue.')").bind(id).run();
      return json({ success: true, id }, 201);
    }

    if (action === 'update') {
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Valid prospect ID is required.' }, 422);
      const existing = await env.DB.prepare('SELECT * FROM sponsor_prospects WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Prospect not found.' }, 404);
      const stage = text(data.stage, 40);
      const partnerType = text(data.partner_type, 40);
      const division = text(data.division, 40);
      const website = safeUrl(data.website);
      const sourceUrl = safeUrl(data.source_url);
      const fitScore = Number(data.fit_score);
      const value = cents(data.estimated_value_cents);
      const followUp = dateOrNull(data.next_follow_up_date);
      if (!text(data.organization, 180)) return json({ error: 'Organization name is required.' }, 422);
      if (!STAGES.has(stage) || !TYPES.has(partnerType) || !DIVISIONS.has(division)) return json({ error: 'Choose valid prospect type, division and pipeline stage.' }, 422);
      if (website === null || sourceUrl === null) return json({ error: 'Website and source links must use HTTPS.' }, 422);
      if (!Number.isInteger(fitScore) || fitScore < 0 || fitScore > 10 || Number.isNaN(value) || Number.isNaN(followUp)) return json({ error: 'Fit score, value or follow-up date is invalid.' }, 422);
      if (stage === 'owner_approved' && !existing.owner_approved_at) return json({ error: 'Use the explicit outreach approval action to authorize contact.' }, 409);
      if (CONTACTED_STAGES.has(stage) && !existing.owner_approved_at) return json({ error: 'Owner approval is required before recording outreach or advancing this prospect.' }, 409);
      await env.DB.prepare(
        "UPDATE sponsor_prospects SET organization = ?, partner_type = ?, division = ?, category = ?, location = ?, website = ?, source_url = ?, contact_route = ?, public_phone = ?, public_email = ?, contact_name = ?, fit_score = ?, stage = ?, estimated_value_cents = ?, next_follow_up_date = ?, qualification_notes = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(text(data.organization, 180), partnerType, division, text(data.category, 120), text(data.location, 180), website, sourceUrl, text(data.contact_route, 500), text(data.public_phone, 80), text(data.public_email, 254), text(data.contact_name, 120), fitScore, stage, value, followUp, text(data.qualification_notes, 2000), text(data.notes, 3000), id).run();
      return json({ success: true, id });
    }

    if (action === 'approve_outreach') {
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Valid prospect ID is required.' }, 422);
      const existing = await env.DB.prepare('SELECT id, stage, owner_approved_at FROM sponsor_prospects WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Prospect not found.' }, 404);
      if (existing.owner_approved_at) return json({ error: 'Outreach is already approved for this prospect.' }, 409);
      if (!['qualified','contact_route_verified'].includes(existing.stage)) return json({ error: 'Qualify the prospect and verify its contact route before approving outreach.' }, 409);
      await env.DB.prepare("UPDATE sponsor_prospects SET owner_approved_at = datetime('now'), owner_approved_by = 'owner', stage = 'owner_approved', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      await env.DB.prepare("INSERT INTO sponsor_prospect_activities (prospect_id, activity_type, summary) VALUES (?, 'approval', 'Owner approved external outreach. No message was sent by the system.')").bind(id).run();
      return json({ success: true, id, stage: 'owner_approved' });
    }

    if (action === 'log_activity') {
      const id = Number(data.id);
      const activityType = text(data.activity_type, 40);
      const summary = text(data.summary, 1000);
      if (!Number.isSafeInteger(id) || id < 1 || !ACTIVITIES.has(activityType) || !summary) return json({ error: 'Prospect, activity type and summary are required.' }, 422);
      const existing = await env.DB.prepare('SELECT id, owner_approved_at FROM sponsor_prospects WHERE id = ?').bind(id).first();
      if (!existing) return json({ error: 'Prospect not found.' }, 404);
      if (['outreach','response','meeting','proposal','contract'].includes(activityType) && !existing.owner_approved_at) return json({ error: 'Owner approval is required before logging external partner activity.' }, 409);
      await env.DB.prepare('INSERT INTO sponsor_prospect_activities (prospect_id, activity_type, summary) VALUES (?, ?, ?)').bind(id, activityType, summary).run();
      if (activityType === 'outreach') {
        await env.DB.prepare("UPDATE sponsor_prospects SET stage = 'contacted', last_contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();
      } else if (activityType === 'response') {
        await env.DB.prepare("UPDATE sponsor_prospects SET stage = 'responded', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      } else if (activityType === 'meeting') {
        await env.DB.prepare("UPDATE sponsor_prospects SET stage = 'discovery', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      } else if (activityType === 'proposal') {
        await env.DB.prepare("UPDATE sponsor_prospects SET stage = 'proposal', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      } else if (activityType === 'contract') {
        await env.DB.prepare("UPDATE sponsor_prospects SET stage = 'contracted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      }
      return json({ success: true, id });
    }

    return json({ error: 'Unknown prospect CRM action.' }, 400);
  } catch (error) {
    console.error('Sponsor prospect CRM write failed:', error?.message || String(error));
    return json({ error: 'Prospect record could not be saved.' }, 500);
  }
}
