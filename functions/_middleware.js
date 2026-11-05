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
    const turnstileKey = env.TURNSTILE_SITE_KEY || '';
    const ga4Id = env.GA4_ID || '';
    const adsenseId = env.ADSENSE_ID || '';
    let headInjections = '';
    if (turnstileKey) {
      headInjections += '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
    }
    if (ga4Id) {
      headInjections += '<script async src="https://www.googletagmanager.com/gtag/js?id=' + ga4Id + '"></script>';
      headInjections += '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","' + ga4Id + '");</script>';
    }
    if (adsenseId) {
      headInjections += '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + adsenseId + '" crossorigin="anonymous"></script>';
    }
    const formScript = '<script>window.TURNSTILE_SITE_KEY="' + turnstileKey + '";</script><script src="/forms.js" defer></script>';
    const rewriter = new HTMLRewriter()
      .on('head', {
        element(element) {
          if (headInjections) element.prepend(headInjections, { html: true });
        }
      })
      .on('head', {
        element(element) {
          element.append(formScript, { html: true });
        }
      });
    const transformed = rewriter.transform(response);
    const newHeaders = new Headers(transformed.headers);
    Object.entries(securityHeaders).forEach(([key, value]) => { newHeaders.set(key, value); });
    return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers: newHeaders });
  }
  const newHeaders = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([key, value]) => { newHeaders.set(key, value); });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
}
