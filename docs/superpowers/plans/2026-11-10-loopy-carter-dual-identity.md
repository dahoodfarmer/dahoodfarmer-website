# Implementation Plan: Loopy Carter + Da HoodFarmer Dual Identity

Spec: `docs/superpowers/specs/2026-11-10-loopy-carter-dual-identity-design.md`
Branch: `feature/loopy-carter-dual-identity`
Base: `1d5238a8833ce0ea65a24213b57ed97245a498b7`

## Global constraints

- Preserve the production branch `site-rebuild-v2`; implement only on this feature branch.
- Keep existing Cloudflare Pages Functions, forms, D1 bindings, KV, Turnstile, Access, and payment integrations untouched.
- Loopy Carter and Da HoodFarmer receive equal public prominence but resolve to one shared Person entity.
- Do not expose the legal/personal name, private child details, unverified audience metrics, or fabricated credits.
- Keep the current static HTML/CSS/JS architecture; no new paid dependencies.

## Task 1 — Identity architecture and design documentation
- Add the approved design spec and this plan to `docs/superpowers/`.
- Confirm the production baseline and feature branch.
- Expected: both docs exist on the feature branch; production branch remains unchanged.

## Task 2 — Shared public identity and navigation
- Update `public/script.js` shared header and footer to give Loopy Carter and Da HoodFarmer separate, equally visible navigation links.
- Preserve existing navigation destinations, mobile menu behavior, and footer legal links.
- Add accessible labels and active-state behavior for both identity pages.
- Expected: no duplicate layout injection; all current links still work; the two new links resolve to the new pages.

## Task 3 — Homepage and About page repositioning
- Update `public/index.html` so the hero presents both Loopy Carter and Da HoodFarmer as co-equal identities.
- Replace text-only placeholder sections with a clear public-figure and agricultural-brand structure, using existing brand colors and assets where appropriate.
- Update `public/about.html` with a more complete biography and accurate wording.
- Remove inaccurate military-service language; present academy leadership as academy experience.
- Expected: homepage title/description and page copy include both identities; no legal name or veteran claim appears.

## Task 4 — Dedicated identity landing pages
- Create `public/loopy-carter.html` with the public-figure biography, education, recognitions, TV/media, family heritage, and booking/press links.
- Create `public/da-hoodfarmer.html` with agriculture, livestock, cowboy/outdoor identity, survival instruction, media, and commercial partnership information.
- Keep the two pages distinct in focus but consistent in facts and shared identity.
- Expected: both routes are independently crawlable, useful without JavaScript, and link to one another.

## Task 5 — Search and structured-data foundation
- Add page-specific canonical, description, Open Graph, Twitter card, and JSON-LD metadata.
- Use one stable Person `@id` across homepage and both identity pages; include Da HoodFarmer as alternateName and associated Brand.
- Add approved social URLs only; no guessed profiles.
- Update `public/sitemap.xml` with both new routes and appropriate priorities.
- Ensure `public/robots.txt` remains crawl-friendly and does not block public profile pages.
- Expected: each page has a unique title, description, canonical URL, image metadata, and parseable JSON-LD.

## Task 6 — Visual assets
- Prepare optimized, appropriately cropped versions of the actual user-supplied portrait and approved Da HoodFarmer crown logo.
- Do not publish sensitive or unrelated images from the user's file library.
- Add meaningful alt text and Open Graph image dimensions.
- Expected: all referenced assets load; image captions/alt text accurately describe the photos; no generated image is represented as a real photograph.

## Task 7 — Verification and preview
- Run source-level checks for all public routes, metadata, structured data, internal links, and sitemap entries.
- Review the Git diff for accidental form, security, or environment changes.
- Wait for the Cloudflare Pages preview deployment and verify its success.
- Verify the production branch and custom domains remain unchanged.
- Expected: preview deployment succeeds; no production data/configuration is changed; any remaining photo or credit limitations are reported honestly.

## Task 8 — Review and release proposal
- Review the completed diff against the design spec.
- Open a pull request targeting `site-rebuild-v2` with clear release notes and verification evidence.
- Do not merge to production until the preview and regression checks are clean.
