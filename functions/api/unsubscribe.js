import { sanitizeString, isValidPayload } from '../lib/validation.js';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function escapeHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function htmlResponse(title, message, showForm, email, token) {
  var formHtml = showForm ? '<form method="POST" action="/api/unsubscribe" style="margin-top:1.5rem;"><input type="hidden" name="email" value="' + email + '"><input type="hidden" name="token" value="' + token + '"><button type="submit" class="btn btn-gold">Confirm Unsubscribe</button></form>' : '';
  return new Response('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + title + '</title><link rel="stylesheet" href="/styles.css"></head><body><div class="page-content" style="max-width:500px;margin:2rem auto;text-align:center;"><h1>' + title + '</h1><p>' + message + '</p>' + formHtml + '<p style="margin-top:1.5rem;"><a href="/" class="btn btn-outline">Return to Homepage</a></p></div><script src="/script.js"></script></body></html>', { headers: { 'Content-Type': 'text/html' } });
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = sanitizeString(url.searchParams.get('email') || '', 254).toLowerCase();
  const token = sanitizeString(url.searchParams.get('token') || '', 100);
  if (!email || !token) return htmlResponse('Unsubscribe', 'This unsubscribe link is incomplete. Please use the unsubscribe link from your newsletter email.', false, '', '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return htmlResponse('Unsubscribe', 'Invalid unsubscribe link.', false, '', '');
  try {
    const subscriber = await env.DB.prepare('SELECT id, unsubscribe_token FROM newsletter_subscribers WHERE email = ? AND status = ?').bind(email, 'active').first();
    if (!subscriber || !subscriber.unsubscribe_token || subscriber.unsubscribe_token !== token) return htmlResponse('Unsubscribe', 'This unsubscribe link is invalid or has already been used.', false, '', '');
    return htmlResponse('Confirm Unsubscribe', 'Are you sure you want to unsubscribe from the Da HoodFarmer newsletter? Click the button below to confirm.', true, escapeHtml(email), escapeHtml(token));
  } catch (err) { return htmlResponse('Unsubscribe', 'An error occurred. Please try again later.', false, '', ''); }
}
export async function onRequestPost({ request, env }) {
  let data; try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!isValidPayload(data)) return json({ error: 'Invalid request body' }, 400);
  const email = sanitizeString(data.email || '', 254).toLowerCase();
  const token = sanitizeString(data.token || '', 100);
  if (!email) return json({ error: 'Email is required' }, 422);
  if (!token) return json({ error: 'Unsubscribe token is required' }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid request' }, 422);
  try {
    const subscriber = await env.DB.prepare('SELECT id, unsubscribe_token, status FROM newsletter_subscribers WHERE email = ?').bind(email).first();
    if (!subscriber) return json({ error: 'Unsubscribe request could not be processed.' }, 422);
    if (subscriber.unsubscribe_token !== token) return json({ error: 'Invalid unsubscribe token.' }, 422);
    if (subscriber.status !== 'active') return json({ success: true, message: 'You are already unsubscribed.' });
    const result = await env.DB.prepare("UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE email = ? AND status = 'active'").bind(email).run();
    if (result.meta.changes === 0) return json({ success: true, message: 'You are already unsubscribed.' });
    return json({ success: true, message: 'You have been successfully unsubscribed.' });
  } catch (err) { return json({ error: 'Unsubscribe failed. Please try again later.' }, 500); }
}
