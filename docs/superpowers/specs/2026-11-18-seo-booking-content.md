# SEO and Booking Content Improvement — Design

**Date:** 2026-11-18

## Goal

Improve the site's internal discovery paths and make the Booking page more useful to event organizers, media contacts, agricultural partners, and community organizations without changing the site's operating behavior.

## Verified implementation context

- Cloudflare Pages publishes the `public/` directory from `site-rebuild-v2`.
- The global header and footer are inserted by `public/script.js`; page-specific links must also remain present in static HTML.
- `functions/_middleware.js` injects canonical URLs and security headers.
- `public/robots.txt` permits public-page crawling and excludes only `/admin/` and `/api/`.
- Booking URL variants tested through the live site resolve to `https://dahoodfarmer.com/booking`.

## Scope

- `public/index.html`: shorten the meta description and add a direct Press Kit link alongside the TV & Media link.
- `public/booking.html`: explain the existing booking categories, provide useful inquiry guidance, and add contextual links to relevant pages.
- `public/about.html`: add direct links to Agriculture, TV & Media, and the Press Kit where those topics are discussed.
- `public/press-kit.html`: add a direct booking path alongside the press contact.

## Content rules

- Use only offerings and biography details already present in owner-approved site copy.
- Do not invent prices, response-time guarantees, availability, travel terms, or unconfirmed services.
- State that a submitted form is an inquiry, not a confirmed booking.
- Preserve the existing form fields, names, action behavior, Turnstile widget, and form scripts.

## Out of scope

- No changes to DNS, Cloudflare settings, Worker or Pages configuration, secrets, databases, payment flows, or production deployment.
- No changes to canonical-generation middleware, redirects, robots.txt, sitemap.xml, or the indexing tracker.
- No merge to the production branch.

## Acceptance criteria

1. The homepage has a direct static HTML link to `/press-kit`.
2. The Booking page explains all six existing inquiry categories and links to relevant background pages.
3. The Booking form retains its current required fields and Turnstile container.
4. About and Press Kit pages link to relevant high-value destinations.
5. All new internal links target existing routes.
6. No new `noindex` directive or duplicate canonical is introduced.
