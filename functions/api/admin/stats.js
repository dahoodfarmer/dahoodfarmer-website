import { getStats } from '../../lib/db.js';
export async function onRequestGet({ env }) {
  try {
    const stats = await getStats(env.DB);
    const rc = await env.DB.prepare('SELECT id,name,email,subject,status,created_at FROM contacts ORDER BY created_at DESC LIMIT 5').all();
    const rb = await env.DB.prepare('SELECT id,name,email,inquiry_type,preferred_date,status,created_at FROM bookings ORDER BY created_at DESC LIMIT 5').all();
    return new Response(JSON.stringify({ stats, recentContacts: rc.results||[], recentBookings: rb.results||[] }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (e) { return new Response(JSON.stringify({ error: 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
}
