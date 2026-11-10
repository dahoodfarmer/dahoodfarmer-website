import { APEX_MODEL, buildSystemPrompt } from '../../lib/apex.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const MAX_BODY = 14000;
const MAX_MESSAGE = 2200;
const WINDOW_SECONDS = 600;
const MAX_REQUESTS = 12;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

async function verifyTurnstile(token, request, env) {
  if (!token || !env.TURNSTILE_SECRET_KEY) return false;
  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const result = await response.json();
    return response.ok && result.success === true;
  } catch { return false; }
}

async function enforceRateLimit(request, env) {
  if (!env.SESSIONS || !env.APEX_RATE_LIMIT_SALT) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'apex:rate:' + await sha256(env.APEX_RATE_LIMIT_SALT + ':' + ip);
  const now = Math.floor(Date.now() / 1000);
  let state = null;
  try { state = await env.SESSIONS.get(key, 'json'); } catch {}
  if (!state || now - state.start >= WINDOW_SECONDS) {
    await env.SESSIONS.put(key, JSON.stringify({ start: now, count: 1 }), { expirationTtl: WINDOW_SECONDS });
    return true;
  }
  if (state.count >= MAX_REQUESTS) return false;
  await env.SESSIONS.put(key, JSON.stringify({ start: state.start, count: state.count + 1 }), { expirationTtl: Math.max(60, WINDOW_SECONDS - (now - state.start)) });
  return true;
}

async function recordEvent(env, event) {
  if (!env.APEX_DB) return;
  try {
    await env.APEX_DB.prepare(
      'INSERT INTO apex_events (id, conversation_id, event_type, target_path, specialist, model, status, latency_ms, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      crypto.randomUUID(), event.conversationId, event.eventType, event.targetPath || null, event.specialist || null,
      event.model || null, event.status || 'ok', event.latencyMs || null,
      event.inputTokens || 0, event.outputTokens || 0
    ).run();
  } catch (error) {
    console.error('APEX analytics write failed:', error?.message || 'unknown');
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!sameOrigin(request)) return json({ error: 'Request origin could not be verified.' }, 403);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'JSON is required.' }, 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY) return json({ error: 'Message is too large.' }, 413);
  if (!env.AI) return json({ error: 'APEX is being prepared. Please try again soon.' }, 503);
  if (!env.SESSIONS || !env.APEX_RATE_LIMIT_SALT) return json({ error: 'APEX is temporarily unavailable while its security settings are completed.' }, 503);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'Message is too large.' }, 413);
    payload = JSON.parse(raw);
  } catch { return json({ error: 'The message could not be read.' }, 400); }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE) return json({ error: 'Enter a message of 1–2,200 characters.' }, 400);
  if (!await enforceRateLimit(request, env)) return json({ error: 'Please wait a few minutes before sending another message.' }, 429);
  if (!await verifyTurnstile(payload.turnstileToken, request, env)) return json({ error: 'Please complete the security check and try again.' }, 403);

  const conversationId = /^[0-9a-f-]{36}$/i.test(payload.conversationId || '') ? payload.conversationId : crypto.randomUUID();
  const { specialist, prompt } = buildSystemPrompt(message);
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const messages = [{ role: 'system', content: prompt }];
  for (const item of history) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') continue;
    const content = item.content.trim().slice(0, 1200);
    if (content) messages.push({ role: item.role, content });
  }
  messages.push({ role: 'user', content: message });

  if (!history.length) {
    const startEvent = { conversationId, eventType: 'chat_start', status: 'ok' };
    if (waitUntil) waitUntil(recordEvent(env, startEvent));
    else await recordEvent(env, startEvent);
  }

  const started = Date.now();
  try {
    const result = await env.AI.run(APEX_MODEL, {
      messages,
      max_tokens: 600,
      temperature: 0.35,
      top_p: 0.85
    });
    const answer = typeof result?.response === 'string' ? result.response.trim() : '';
    if (!answer) throw new Error('Empty model response');
    const event = {
      conversationId, eventType: 'chat_response', specialist, model: APEX_MODEL,
      status: 'success', latencyMs: Date.now() - started,
      inputTokens: result?.usage?.prompt_tokens || 0,
      outputTokens: result?.usage?.completion_tokens || 0
    };
    if (waitUntil) waitUntil(recordEvent(env, event));
    else await recordEvent(env, event);
    return json({ answer, conversationId, specialist, model: APEX_MODEL });
  } catch (error) {
    console.error('APEX inference failed:', error?.message || 'unknown');
    if (waitUntil) waitUntil(recordEvent(env, {
      conversationId, eventType: 'chat_error', specialist, model: APEX_MODEL,
      status: 'error', latencyMs: Date.now() - started
    }));
    return json({ error: 'APEX could not complete that response. Please try again.' }, 502);
  }
}
