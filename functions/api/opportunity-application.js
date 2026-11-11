import { getClientIP, isValidPayload, checkRateLimit } from '../lib/validation.js';
import { verifyTurnstile, sendSubmissionNotification } from '../lib/turnstile.js';
import { validateOpportunityApplication } from '../lib/opportunity.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function getSameOriginSourcePath(request) {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get('Referer');
  if (!referer) return '/';
  try {
    const sourceUrl = new URL(referer);
    return sourceUrl.origin === requestUrl.origin ? sourceUrl.pathname.slice(0, 200) || '/' : '/';
  } catch {
    return '/';
  }
}

export async function onRequestPost({ request, env }) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env.SESSIONS, ip, 'opportunity-application', 5, 60);
  if (!allowed) return json({ error: 'Too many application attempts. Please try again in a minute.' }, 429);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!isValidPayload(data)) return json({ error: 'Invalid application payload' }, 400);

  const sourcePath = getSameOriginSourcePath(request);
  const validation = validateOpportunityApplication(data, sourcePath);
  if (!validation.valid) return json({ error: validation.errors.join(', ') }, 422);

  const expectedHostname = new URL(request.url).hostname;
  const turnstile = await verifyTurnstile(
    data['cf-turnstile-response'],
    env.TURNSTILE_SECRET_KEY,
    ip,
    expectedHostname
  );
  if (!turnstile.success) return json({ error: turnstile.error }, 403);

  const application = validation.sanitized;
  const insertSql = 'INSERT INTO opportunity_applications (' +
    'application_type, name, email, organization, website, country, region, city, ' +
    'category, requested_package, event_interest, preferred_date, message, ' +
    'public_description, contact_consent, marketing_consent, public_listing_consent, ' +
    'source_path' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  try {
    await env.DB.prepare(insertSql).bind(
      application.application_type,
      application.name,
      application.email,
      application.organization,
      application.website,
      application.country,
      application.region,
      application.city,
      application.category,
      application.requested_package,
      application.event_interest,
      application.preferred_date,
      application.message,
      application.public_description,
      application.contact_consent ? 1 : 0,
      application.marketing_consent ? 1 : 0,
      application.public_listing_consent ? 1 : 0,
      application.source_path
    ).run();
  } catch (error) {
    console.error('Opportunity application save failed:', error?.stack || error?.message || String(error));
    return json({ error: 'Your application could not be saved. Please try again later.' }, 500);
  }

  try {
    const notice = await sendSubmissionNotification(
      env,
      'New DHF opportunity application: ' + application.application_type.replaceAll('_', ' '),
      application,
      application.email
    );
    if (!notice.sent) console.warn('Opportunity application notification not sent:', notice.reason);
  } catch (error) {
    console.warn('Opportunity application notification failed after the application was saved:', error?.message || String(error));
  }

  return json({
    success: true,
    message: 'Your application has been received. It is not an approval, booking, or reservation; the DHF team will review it and follow up.'
  });
}
