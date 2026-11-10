export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7)));
  const windowExpr = '-' + days + ' days';
  const readiness = {
    model_binding_configured: Boolean(env.AI),
    telemetry_database_configured: Boolean(env.APEX_DB),
    rate_limit_configured: Boolean(env.SESSIONS && env.APEX_RATE_LIMIT_SALT),
    turnstile_site_key_configured: Boolean(env.TURNSTILE_SITE_KEY),
    turnstile_secret_configured: Boolean(env.TURNSTILE_SECRET_KEY),
    owner_access_configured: Boolean(env.ACCESS_ISSUER && env.ACCESS_AUD)
  };

  const empty = {
    widget_opens: 0, chat_starts: 0, responses: 0, errors: 0,
    cta_clicks: 0, lead_submissions: 0, confirmed_purchases: 0,
    avg_latency_ms: null, input_tokens: 0, output_tokens: 0, conversations: 0
  };
  if (!env.APEX_DB) {
    return Response.json({
      period_days: days,
      generated_at: new Date().toISOString(),
      readiness,
      summary: empty,
      specialists: [],
      feedback: [],
      rates: { request_success_rate_pct: null, error_rate_pct: null, helpful_feedback_pct: null },
      limitations: [
        'APEX telemetry is not connected to a dedicated non-production D1 database.',
        'No prompts or response text are stored.',
        'Website visitor totals and attributable revenue require separate verified analytics and commerce sources.'
      ]
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const [summary, specialists, feedback, eventTypes, leadsByPath] = await Promise.all([
      env.APEX_DB.prepare(`SELECT
        SUM(CASE WHEN event_type='widget_open' THEN 1 ELSE 0 END) AS widget_opens,
        COUNT(DISTINCT CASE WHEN event_type='chat_start' THEN conversation_id END) AS chat_starts,
        SUM(CASE WHEN event_type='chat_response' THEN 1 ELSE 0 END) AS responses,
        SUM(CASE WHEN event_type='chat_error' THEN 1 ELSE 0 END) AS errors,
        SUM(CASE WHEN event_type='cta_click' THEN 1 ELSE 0 END) AS cta_clicks,
        SUM(CASE WHEN event_type='lead_submit' THEN 1 ELSE 0 END) AS lead_submissions,
        SUM(CASE WHEN event_type='purchase_confirmed' THEN 1 ELSE 0 END) AS confirmed_purchases,
        AVG(CASE WHEN event_type='chat_response' THEN latency_ms END) AS avg_latency_ms,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        COUNT(DISTINCT conversation_id) AS conversations
        FROM apex_events WHERE created_at >= datetime('now', ?)`).bind(windowExpr).first(),
      env.APEX_DB.prepare(`SELECT specialist, COUNT(*) AS responses, AVG(latency_ms) AS avg_latency_ms
        FROM apex_events WHERE event_type='chat_response' AND created_at >= datetime('now', ?)
        GROUP BY specialist ORDER BY responses DESC`).bind(windowExpr).all(),
      env.APEX_DB.prepare(`SELECT rating, COUNT(*) AS total FROM apex_feedback
        WHERE created_at >= datetime('now', ?) GROUP BY rating`).bind(windowExpr).all(),
      env.APEX_DB.prepare(`SELECT event_type, COUNT(*) AS total FROM apex_events
        WHERE created_at >= datetime('now', ?) GROUP BY event_type ORDER BY total DESC`).bind(windowExpr).all(),
      env.APEX_DB.prepare(`SELECT target_path, COUNT(*) AS leads FROM apex_events
        WHERE event_type='lead_submit' AND created_at >= datetime('now', ?) GROUP BY target_path ORDER BY leads DESC`).bind(windowExpr).all()
    ]);
    const s = { ...empty, ...(summary || {}) };
    const totalResponses = Number(s.responses || 0) + Number(s.errors || 0);
    const helpful = (feedback.results || []).find(x => x.rating === 'helpful')?.total || 0;
    const notHelpful = (feedback.results || []).find(x => x.rating === 'not_helpful')?.total || 0;
    const rated = Number(helpful) + Number(notHelpful);
    return Response.json({
      period_days: days,
      generated_at: new Date().toISOString(),
      readiness,
      summary: s,
      rates: {
        request_success_rate_pct: totalResponses ? Number((Number(s.responses || 0) / totalResponses * 100).toFixed(1)) : null,
        error_rate_pct: totalResponses ? Number((Number(s.errors || 0) / totalResponses * 100).toFixed(1)) : null,
        helpful_feedback_pct: rated ? Number((Number(helpful) / rated * 100).toFixed(1)) : null,
        feedback_sample_size: rated
      },
      specialists: specialists.results || [],
      feedback: feedback.results || [],
      event_types: eventTypes.results || [],
      leads_by_path: leadsByPath.results || [],
      limitations: [
        'APEX analytics stores event metadata only, never visitor prompts or model responses.',
        'CTA clicks are not confirmed leads. Lead submissions are counted only when an explicit lead_submit event is instrumented.',
        'Revenue attribution requires a verified commerce event joined to an approved attribution identifier; no revenue is inferred from clicks.',
        'Website visitor totals require a separate analytics source.'
      ]
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('APEX metrics query failed:', error?.message || 'unknown');
    return Response.json({ error: 'APEX metrics are temporarily unavailable.', readiness }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
