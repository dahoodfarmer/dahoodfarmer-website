const APPLICATION_TYPES = new Set(['business_listing', 'vendor', 'sponsor', 'speaker', 'academy', 'property_partner', 'membership']);
const APPLICATION_STATUSES = new Set(['new', 'reviewing', 'contacted', 'approved', 'declined']);
const LISTING_STATUSES = new Set(['active', 'hidden']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function boundedInt(value, fallback, max) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function sameOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) return origin === expected;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).origin === expected; } catch { return false; }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = boundedInt(url.searchParams.get('page'), 1, 1000000);
  const limit = boundedInt(url.searchParams.get('limit'), 50, 100);
  const offset = (page - 1) * limit;
  const status = (url.searchParams.get('status') || '').trim();
  const type = (url.searchParams.get('type') || '').trim();
  if (status && !APPLICATION_STATUSES.has(status)) return json({ error: 'Invalid application status filter' }, 400);
  if (type && !APPLICATION_TYPES.has(type)) return json({ error: 'Invalid application type filter' }, 400);

  const where = [];
  const values = [];
  if (status) { where.push('a.status = ?'); values.push(status); }
  if (type) { where.push('a.application_type = ?'); values.push(type); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  try {
    const result = await env.DB.prepare(
      'SELECT a.id, a.application_type, a.name, a.email, a.organization, a.website, a.country, a.region, a.city, a.category, a.requested_package, a.event_interest, a.preferred_date, a.message, a.public_description, a.contact_consent, a.marketing_consent, a.public_listing_consent, a.source_path, a.status, a.created_at, a.updated_at, b.status AS listing_status ' +
      'FROM opportunity_applications a LEFT JOIN business_listings b ON b.application_id = a.id' +
      whereSql + ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...values, limit, offset).all();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM opportunity_applications a' + whereSql).bind(...values).first();
    return json({ applications: result.results || [], total: count?.total || 0, page, limit });
  } catch (error) {
    console.error('Admin opportunity application query failed:', error?.stack || error?.message || String(error));
    return json({ error: 'Applications are temporarily unavailable.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Cross-origin request rejected' }, 403);
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Invalid request body' }, 400);

  const id = Number(data.id);
  const status = typeof data.status === 'string' ? data.status.trim() : '';
  const listingStatus = data.listing_status === undefined || data.listing_status === null || data.listing_status === ''
    ? null : String(data.listing_status).trim();
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Valid application ID is required' }, 422);
  if (!APPLICATION_STATUSES.has(status)) return json({ error: 'Invalid application status' }, 422);
  if (listingStatus !== null && !LISTING_STATUSES.has(listingStatus)) return json({ error: 'Invalid listing status' }, 422);

  try {
    const application = await env.DB.prepare(
      'SELECT id, application_type, name, organization, website, country, region, city, category, public_description, public_listing_consent, status FROM opportunity_applications WHERE id = ?'
    ).bind(id).first();
    if (!application) return json({ error: 'Application not found' }, 404);

    if (listingStatus !== null && application.application_type !== 'business_listing') {
      return json({ error: 'Only business listing applications can change directory publication' }, 409);
    }
    if (listingStatus === 'active') {
      if (status !== 'approved') return json({ error: 'The application must remain approved while publishing' }, 409);
      if (application.status !== 'approved') return json({ error: 'Approve the application before publishing its listing' }, 409);
      if (Number(application.public_listing_consent) !== 1) return json({ error: 'Applicant has not consented to public listing' }, 409);
      if (!String(application.public_description || '').trim()) return json({ error: 'A public description is required before publication' }, 409);
    }

    if (status !== 'approved' || listingStatus === 'hidden') {
      await env.DB.prepare("UPDATE business_listings SET status = 'hidden', updated_at = datetime('now') WHERE application_id = ?").bind(id).run();
    }

    await env.DB.prepare("UPDATE opportunity_applications SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id).run();

    if (listingStatus === 'active') {
      const businessName = String(application.organization || application.name || '').trim();
      await env.DB.prepare(
        "INSERT INTO business_listings (application_id, business_name, description, website, category, city, region, country, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now')) " +
        "ON CONFLICT(application_id) DO UPDATE SET business_name = excluded.business_name, description = excluded.description, website = excluded.website, category = excluded.category, city = excluded.city, region = excluded.region, country = excluded.country, status = 'active', updated_at = datetime('now'), published_at = COALESCE(business_listings.published_at, datetime('now'))"
      ).bind(
        id,
        businessName,
        String(application.public_description || '').trim(),
        String(application.website || ''),
        String(application.category || ''),
        String(application.city || ''),
        String(application.region || ''),
        String(application.country || '')
      ).run();
    }

    return json({ success: true, application_id: id, status, listing_status: listingStatus || (status === 'approved' ? 'unchanged' : 'hidden') });
  } catch (error) {
    console.error('Admin opportunity application update failed:', error?.stack || error?.message || String(error));
    return json({ error: 'Application update failed.' }, 500);
  }
}
