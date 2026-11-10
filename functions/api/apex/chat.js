import { createApexAttributionToken, getApexRateLimitSalt } from '../../lib/apex-analytics.js';
import { buildSystemPrompt } from '../../lib/apex.js';
import { runApexModel } from '../../lib/apex-model.js';

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
  if (!token || !(env.APEX_TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY)) return false;
  const body = new URLSearchParams();
  body.set('secret', env.APEX_TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!response.ok) return false;
    const result = await response.json();
    const expectedHostname = env.APEX_EXPECTED_HOSTNAME || new URL(request.url).hostname;
    return result.success === true &&
      result.hostname === expectedHostname &&
      result.action === 'apex_chat';
  } catch { return false; }
}

export async function enforceRateLimit(request, env, salt) {
  if (!env.APEX_DB || !salt) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Persist only a salted hash of the client IP; never store the raw address.
  const key = await sha256(salt + ':' + ip);
  const now = Math.floor(Date.now() / 1000);
  const windowStartCutoff = now - WINDOW_SECONDS;
  try {
    const row = await env.APEX_DB.prepare(
      "INSERT INTO apex_rate_limits (rate_key, window_start, request_count) VALUES (?, ?, 1) " +
      "ON CONFLICT(rate_key) DO UPDATE SET " +
      "window_start = CASE WHEN apex_rate_limits.window_start <= ? THEN ? ELSE apex_rate_limits.window_start END, " +
      "request_count = CASE WHEN apex_rate_limits.window_start <= ? THEN 1 ELSE apex_rate_limits.request_count + 1 END, " +
      "updated_at = datetime('now') " +
      "WHERE apex_rate_limits.window_start <= ? OR apex_rate_limits.request_count < ? " +
      "RETURNING request_count"
    ).bind(key, now, windowStartCutoff, now, windowStartCutoff, windowStartCutoff, MAX_REQUESTS).first();
    // Opportunistically expire stale hashed identifiers without storing visitor history.
    if (now % 3600 < 10) {
      try { await env.APEX_DB.prepare("DELETE FROM apex_rate_limits WHERE window_start < ?").bind(now - 86400).run(); } catch {}
    }
    return Boolean(row);
  } catch (error) {
    console.error('APEX rate limit check failed:', error?.message || 'unknown');
    return false;
  }
}

export async function reserveDailyInference(env) {
  if (!env.APEX_DB) return false;
  const cap = Math.min(20, Math.max(1, Number(env.APEX_DAILY_REQUEST_LIMIT || 20)));
  const day = new Date().toISOString().slice(0, 10);
  try {
    const row = await env.APEX_DB.prepare(
      "INSERT INTO apex_daily_usage (usage_date, request_count) VALUES (?, 1) ON CONFLICT(usage_date) DO UPDATE SET request_count = request_count + 1, updated_at = datetime('now') WHERE request_count < ? RETURNING request_count"
    ).bind(day, cap).first();
    return Boolean(row);
  } catch (error) {
    console.error('APEX daily inference budget check failed:', error?.message || 'unknown');
    return false;
  }
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
  // Enforce the feature flag at the API boundary, not only in page rendering.
  // This keeps direct API calls disabled until the owner explicitly enables APEX.
  if (env.APEX_ENABLED !== 'true') return json({ error: 'APEX is not enabled.' }, 404);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({ error: 'JSON is required.' }, 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY) return json({ error: 'Message is too large.' }, 413);
  const provider = String(env.APEX_PROVIDER || 'cloudflare').toLowerCase();
  const providerReady = provider === 'cloudflare' ? Boolean(env.AI)
    : provider === 'openai' ? Boolean(env.OPENAI_API_KEY)
    : provider === 'anthropic' ? Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL)
    : false;
  if (!providerReady) return json({ error: 'APEX is being prepared. Please try again soon.' }, 503);
  const rateLimitSalt = await getApexRateLimitSalt(env);
  if (!env.SESSIONS || !rateLimitSalt || !env.APEX_DB) return json({ error: 'APEX is temporarily unavailable while its security settings are completed.' }, 503);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'Message is too large.' }, 413);
    payload = JSON.parse(raw);
  } catch { return json({ error: 'The message could not be read.' }, 400); }

  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE) return json({ error: 'Enter a message of 1–2,200 characters.' }, 400);
  if (!await enforceRateLimit(request, env, rateLimitSalt)) return json({ error: 'Please wait a few minutes before sending another message.' }, 429);
  if (!await verifyTurnstile(payload.turnstileToken, request, env)) return json({ error: 'Please complete the security check and try again.' }, 403);

  const conversationId = /^[0-9a-f-]{36}$/i.test(payload.conversationId || '') ? payload.conversationId : crypto.randomUUID();
  const { specialist, prompt, sources } = buildSystemPrompt(message);
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

  if (!await reserveDailyInference(env)) return json({ error: 'APEX has reached its preview evaluation limit for today. Please try again tomorrow.' }, 429);

  const started = Date.now();
  try {
    const result = await runApexModel(env, messages, { maxTokens: 600, temperature: 0.35, topP: 0.85 });
    const answer = typeof result?.response === 'string' ? result.response.trim() : '';
    if (!answer) throw new Error('Empty model response');
    const event = {
      conversationId, eventType: 'chat_response', specialist, model: result.provider + '/' + result.model,
      status: 'success', latencyMs: Date.now() - started,
      inputTokens: result?.usage?.prompt_tokens || 0,
      outputTokens: result?.usage?.completion_tokens || 0
    };
    if (waitUntil) waitUntil(recordEvent(env, event));
    else await recordEvent(env, event);
    const apexRef = await createApexAttributionToken(env, conversationId);
    return json({ answer, conversationId, specialist, provider: result.provider, model: result.model, sources, apexRef });
  } catch (error) {
    console.error('APEX inference failed:', error?.message || 'unknown');
    if (waitUntil) waitUntil(recordEvent(env, {
      conversationId, eventType: 'chat_error', specialist, model: provider + '/' + (env.APEX_MODEL || env.OPENAI_MODEL || env.ANTHROPIC_MODEL || 'unconfigured'),
      status: 'error', latencyMs: Date.now() - started
    }));
    return json({ error: 'APEX could not complete that response. Please try again.' }, 502);
  }
}
