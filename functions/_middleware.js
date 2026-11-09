// Global middleware for all routes
// Handles: www→apex redirect, security headers, CSP Report-Only,
// Turnstile/GA4/AdSense injection (safely encoded), forms.js, canonical URLs,
// skip-to-content link

// Safely encode a value for injection into an inline <script> tag
// Prevents </script> injection and quote escaping attacks
function safeJsValue(value) {
  return JSON.stringify(String(value || '')).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Protect the admin dashboard and every admin API route. This applies to
  // production and preview deployments, which currently share the same D1/KV.
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/') || url.pathname.startsWith('/api/admin/')) {
    const { requireAdminAccess } = await import('./lib/access.js');
    const denied = await requireAdminAccess(request, env);
    if (denied) return denied;
  }

  // Redirect www to apex domain
  if (url.hostname === 'www.dahoodfarmer.com') {
    url.hostname = 'dahoodfarmer.com';
    return Response.redirect(url.toString(), 301);
  }

  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    // CSP in Report-Only mode — does not block anything, just reports violations
    // Check browser console or configure a report-uri to see violations
    // Once all violations are resolved, change to Content-Security-Policy to enforce
    'Content-Security-Policy-Report-Only': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://adservice.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://www.google-analytics.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net",
      "frame-src https://challenges.cloudflare.com https://googleads.g.doubleclick.net",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
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

    // Build head injections — all values safely encoded
    let inj = '';
    if (tsKey) {
      inj += '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>';
    }
    if (ga4Id) {
      inj += '<script async src="https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id) + '"></script>';
      inj += '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",' + safeJsValue(ga4Id) + ')</script>';
    }
    if (adId) {
      inj += '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(adId) + '" crossorigin="anonymous"></script>';
    }

    // Safely encode the Turnstile site key for inline script
    const formScript = '<script>window.TURNSTILE_SITE_KEY=' + safeJsValue(tsKey) + '</script><script src="/forms.js" defer></script>';

    // Canonical URL — always uses the production domain
    const canonical = '<link rel="canonical" href="https://dahoodfarmer.com' + url.pathname + '">';

    // Skip-to-content link for keyboard users
    const skipLink = '<a href="#main-content" class="skip-link">Skip to content</a>';

    // Track whether we've added id="main-content" to the first content element
    let mainContentIdAdded = false;

    const rewriter = new HTMLRewriter()
      .on('head', {
        element(el) {
          if (inj) el.prepend(inj, { html: true });
          el.append(canonical + formScript, { html: true });
        }
      })
      .on('.cf-turnstile', {
        element(el) {
          // Override hardcoded data-sitekey with the runtime env value
          // In local dev: replaces production key with test key.
          if (tsKey) el.setAttribute('data-sitekey', tsKey);
        }
      })
      .on('body', {
        element(el) {
          el.prepend(skipLink, { html: true });
        }
      })
      // Add id="main-content" to the first .page-content or .hero element
      .on('.page-content, .hero', {
        element(el) {
          if (!mainContentIdAdded) {
            el.setAttribute('id', 'main-content');
            mainContentIdAdded = true;
          }
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
