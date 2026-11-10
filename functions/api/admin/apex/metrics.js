export async function onRequestGet({ env, request }) {
  if (!env.APEX_DB) return Response.json({ error: 'APEX analytics database is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7)));
  const windowExpr = '-' + days + ' days';
  try {
    const [summary, specialists, feedback] = await Promise.all([
      env.APEX_DB.prepare(`SELECT COUNT(*) AS responses, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS successful, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors, AVG(latency_ms) AS avg_latency_ms, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, COUNT(DISTINCT conversation_id) AS conversations FROM apex_events WHERE event_type IN ('chat_response','chat_error') AND created_at >= datetime('now', ?)`).bind(windowExpr).first(),
      env.APEX_DB.prepare(`SELECT specialist, COUNT(*) AS responses, AVG(latency_ms) AS avg_latency_ms FROM apex_events WHERE event_type='chat_response' AND created_at >= datetime('now', ?) GROUP BY specialist ORDER BY responses DESC`).bind(windowExpr).all(),
      env.APEX_DB.prepare(`SELECT rating, COUNT(*) AS total FROM apex_feedback WHERE created_at >= datetime('now', ?) GROUP BY rating`).bind(windowExpr).all()
    ]);
    return Response.json({
      period_days: days,
      generated_at: new Date().toISOString(),
      summary: summary || {},
      specialists: specialists.results || [],
      feedback: feedback.results || [],
      limitations: ['This endpoint reports APEX events only; it does not measure total website visitors or attributable revenue.', 'Conversation text and visitor email addresses are not stored in APEX analytics.']
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('APEX metrics query failed:', error?.message || 'unknown');
    return Response.json({ error: 'APEX metrics are temporarily unavailable.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
