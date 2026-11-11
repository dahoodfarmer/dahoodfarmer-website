function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function boundedInt(value, fallback, max) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = boundedInt(url.searchParams.get('page'), 1, 1000000);
  const limit = boundedInt(url.searchParams.get('limit'), 50, 100);
  const offset = (page - 1) * limit;
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const country = (url.searchParams.get('country') || '').trim().slice(0, 100);
  const category = (url.searchParams.get('category') || '').trim().slice(0, 100);
  const where = ['status = ?'];
  const values = ['active'];

  if (search) {
    where.push('(business_name LIKE ? OR description LIKE ? OR category LIKE ? OR city LIKE ? OR region LIKE ? OR country LIKE ?)');
    const pattern = '%' + search + '%';
    values.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (country) {
    where.push('LOWER(country) = LOWER(?)');
    values.push(country);
  }
  if (category) {
    where.push('LOWER(category) = LOWER(?)');
    values.push(category);
  }

  const whereSql = ' WHERE ' + where.join(' AND ');
  try {
    const result = await env.DB.prepare(
      'SELECT business_name, description, website, category, city, region, country FROM business_listings' +
      whereSql + ' ORDER BY business_name ASC LIMIT ? OFFSET ?'
    ).bind(...values, limit, offset).all();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM business_listings' + whereSql).bind(...values).first();
    const listings = (result.results || []).map((row) => ({
      business_name: String(row.business_name || ''),
      description: String(row.description || ''),
      website: String(row.website || ''),
      category: String(row.category || ''),
      city: String(row.city || ''),
      region: String(row.region || ''),
      country: String(row.country || '')
    }));
    return json({ listings, total: count?.total || 0, page, limit });
  } catch (error) {
    console.error('Public business directory query failed:', error?.stack || error?.message || String(error));
    return json({ error: 'Business directory is temporarily unavailable.' }, 500);
  }
}
