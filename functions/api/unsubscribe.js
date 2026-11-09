import { sanitizeString, isValidPayload } from '../lib/validation.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function htmlResponse(title, message, showForm, email, token) {
  const formHtml = showForm
    ? '<form method="POST" action="/api/unsubscribe" style="margin-top:1.5rem;">' +
      '<input type="hidden" name="email" value="' + escapeHtml(email) + '">' +
      '<input type="hidden" name="token" value="' + escapeHtml(token) + '">' +
      '<button type="submit" class="btn btn-gold">Confirm Unsubscribe</button></form>'
    : '';

  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + escapeHtml(title) + '</title><link rel="stylesheet" href="/styles.css">' +
    '</head><body><main class="page-content" style="max-width:500px;margin:2rem auto;text-align:center;">' +
    '<h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(message) + '</p>' + formHtml +
    '<p style="margin-top:1.5rem;"><a href="/" class="btn btn-outline">Return to Homepage</a></p>' +
    '</main><script src="/script.js"></script></body></html>',
    {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function responseForRequest(request, title, message, success, status = 200) {
  if ((request.headers.get('Content-Type') || '').includes('application/json')) {
    return json(success ? { success: true, message } : { error: message }, status);
  }
  return htmlResponse(title, message, false, '', '');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = sanitizeString(url.searchParams.get('email') || '', 254).toLowerCase();
  const token = sanitizeString(url.searchParams.get('token') || '', 100);

  if (!email || !token) {
    return htmlResponse('Unsubscribe', 'This unsubscribe link is incomplete. Please use the link from your newsletter email.', false, '', '');
  }
  if (!isValidEmail(email)) return htmlResponse('Unsubscribe', 'Invalid unsubscribe link.', false, '', '');

  try {
    const subscriber = await env.DB.prepare(
      'SELECT id, unsubscribe_token FROM newsletter_subscribers WHERE email = ? AND status = ?'
    ).bind(email, 'active').first();

    if (!subscriber || !subscriber.unsubscribe_token || subscriber.unsubscribe_token !== token) {
      return htmlResponse('Unsubscribe', 'This unsubscribe link is invalid or has already been used.', false, '', '');
    }

    return htmlResponse(
      'Confirm Unsubscribe',
      'Are you sure you want to unsubscribe from the Da HoodFarmer newsletter? Click the button below to confirm.',
      true,
      email,
      token
    );
  } catch (error) {
    console.error('Newsletter unsubscribe lookup failed:', error?.stack || error?.message || String(error));
    return htmlResponse('Unsubscribe', 'An error occurred. Please try again later.', false, '', '');
  }
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('Content-Type') || '';
  let data;

  try {
    if (contentType.includes('application/json')) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }
  } catch {
    return responseForRequest(request, 'Unsubscribe', 'The unsubscribe request could not be read. Please try again.', false, 400);
  }

  if (!isValidPayload(data)) {
    return responseForRequest(request, 'Unsubscribe', 'Invalid unsubscribe request.', false, 400);
  }

  const email = sanitizeString(data.email || '', 254).toLowerCase();
  const token = sanitizeString(data.token || '', 100);

  if (!isValidEmail(email) || !token) {
    return responseForRequest(request, 'Unsubscribe', 'The unsubscribe link is invalid.', false, 422);
  }

  try {
    const subscriber = await env.DB.prepare(
      'SELECT id, unsubscribe_token, status FROM newsletter_subscribers WHERE email = ?'
    ).bind(email).first();

    if (!subscriber || !subscriber.unsubscribe_token || subscriber.unsubscribe_token !== token) {
      return responseForRequest(request, 'Unsubscribe', 'The unsubscribe link is invalid or has expired.', false, 422);
    }

    if (subscriber.status !== 'active') {
      return responseForRequest(request, 'Unsubscribed', 'You are already unsubscribed.', true);
    }

    await env.DB.prepare(
      "UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE email = ? AND status = 'active'"
    ).bind(email).run();

    return responseForRequest(request, 'Unsubscribed', 'You have been successfully unsubscribed.', true);
  } catch (error) {
    console.error('Newsletter unsubscribe update failed:', error?.stack || error?.message || String(error));
    return responseForRequest(request, 'Unsubscribe', 'The unsubscribe request could not be completed. Please try again later.', false, 500);
  }
}
