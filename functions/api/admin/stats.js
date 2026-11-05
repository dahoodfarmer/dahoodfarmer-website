import { getStats } from '../../lib/db.js';
export async function onRequestGet({ env }) {
  const stats = await getStats(env.DB);
  return new Response(JSON.stringify({ stats }), { headers: { 'Content-Type': 'application/json' } });
}
