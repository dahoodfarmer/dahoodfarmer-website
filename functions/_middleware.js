export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.hostname === 'www.dahoodfarmer.com') {
    url.hostname = 'dahoodfarmer.com';
    return Response.redirect(url.toString(), 301);
  }
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...securityHeaders,
        'Access-Control-Allow-Origin': 'https://dahoodfarmer.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  if (url.pathname.startsWith('/api/') && !['POST', 'GET', 'OPTIONS'].includes(request.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }
  const response = await context.next();
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    const tsKey = env.TURNSTILE_SITE_KEY || '';
    const ga4Id = env.GA4_ID || '';
    const adId = env.ADSENSE_ID || '';
    let inj = '';
    if (tsKey) inj += '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
    if (ga4Id) inj += '<script async src="https://www.googletagmanager.com/gtag/js?id=' + ga4Id + '"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","' + ga4Id + '")</script>';
    if (adId) inj += '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + adId + '" crossorigin="anonymous"></script>';
    const fs = '<script>window.TURNSTILE_SITE_KEY="' + tsKey + '"</script><script src="/forms.js" defer></script>';
    const rewriter = new HTMLRewriter().on('head', {
      element(el) {
        if (inj) el.prepend(inj, { html: true });
        el.append(fs, { html: true });
      }
    });
    const transformed = rewriter.transform(response);
    const nh = new Headers(transformed.headers);
    Object.entries(securityHeaders).forEach(([k, v]) => nh.set(k, v));
    return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers: nh });
  }
  const nh = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([k, v]) => nh.set(k, v));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: nh });
}
