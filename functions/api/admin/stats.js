import { getStats } from '../../lib/db.js';

export async function onRequestGet({ env }) {
  try {
    const stats = await getStats(env.DB);
    const rc = await env.DB.prepare('SELECT id,name,email,subject,status,created_at FROM contacts ORDER BY created_at DESC LIMIT 5').all();
    const rb = await env.DB.prepare('SELECT id,name,email,inquiry_type,preferred_date,status,created_at FROM bookings ORDER BY created_at DESC LIMIT 5').all();
    const applications = await env.DB.prepare('SELECT COUNT(*) AS total FROM opportunity_applications').first();
    const newApplications = await env.DB.prepare("SELECT COUNT(*) AS total FROM opportunity_applications WHERE status = 'new'").first();
    const activeListings = await env.DB.prepare("SELECT COUNT(*) AS total FROM business_listings WHERE status = 'active'").first();
    const enrichedStats = {
      ...stats,
      totalApplications: applications?.total || 0,
      newApplications: newApplications?.total || 0,
      activeListings: activeListings?.total || 0
    };
    return new Response(JSON.stringify({
      stats: enrichedStats,
      recentContacts: rc.results || [],
      recentBookings: rb.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (e) {
    console.error('Admin stats query failed:', e?.stack || e?.message || String(e));
    return new Response(JSON.stringify({ error: 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
}
