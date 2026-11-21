# SEO and Booking Content Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve internal links and Booking-page usefulness without changing site behavior or production infrastructure.

**Architecture:** Make small, semantic edits to the static HTML files in `public/`. Keep global navigation in `public/script.js`, canonical generation in `functions/_middleware.js`, and all form processing unchanged.

**Tech Stack:** Static HTML, GitHub contents API, Cloudflare Pages preview build, JavaScript source assertions.

**Spec:** `docs/superpowers/specs/2026-11-18-seo-booking-content.md`

## Global Constraints

- Edit only the static HTML files under `public/` identified in the spec.
- Preserve the existing Booking form field names, required attributes, Turnstile container, and form script.
- Use only owner-approved biography and existing booking categories.
- Do not promise prices, response times, or availability.
- Do not modify DNS, Cloudflare configuration, secrets, database, sitemap, robots, redirects, or canonical middleware.
- Keep the changes on an isolated branch and leave the pull request in draft.

## Review Focus

- Broken or mistyped internal routes.
- Booking form field names or Turnstile markup accidentally changed.
- Duplicate or contradictory canonical/robots directives.
- Unsupported booking claims or invented service commitments.
- Static links omitted because navigation is injected by JavaScript.

---

### Task 1: Homepage Press Kit discovery

**Files:**
- Modify: `public/index.html`

- [ ] Add a direct `/press-kit` link alongside the existing TV & Media CTA.
- [ ] Shorten the homepage meta description without changing the title or biography facts.
- [ ] Verify the Press Kit link and existing Booking, Agriculture, Media, Business, and Contact links remain present.

### Task 2: Booking page usefulness and contextual links

**Files:**
- Modify: `public/booking.html`

- [ ] Add concise descriptions for the six existing inquiry categories: speaking, TV/media, agricultural consulting, wilderness survival instruction, community events, and brand partnerships/sponsorships.
- [ ] Add links to About, Agriculture, TV & Media, Community, Business & Ventures, Press Kit, and Contact.
- [ ] Add practical guidance on what details to include and clarify that an inquiry is not a confirmed booking.
- [ ] Preserve all current form fields, field names, required flags, Turnstile markup, and form scripts.
- [ ] Improve the page title and meta description for clarity.

### Task 3: Strengthen related-page paths

**Files:**
- Modify: `public/about.html`
- Modify: `public/press-kit.html`

- [ ] Add direct Agriculture, TV & Media, and Press Kit links in the relevant About sections.
- [ ] Add a direct Booking link alongside the Press Kit contact CTA.

### Task 4: Static and live verification

- [ ] Assert all new links target routes that exist in `public/`.
- [ ] Assert the Booking form's required fields and Turnstile container are unchanged.
- [ ] Inspect the modified pages through a crawler fetch and verify HTTP 200, canonical URLs, and absence of a page-level `noindex` directive.
- [ ] Confirm `robots.txt` and sitemap remain unchanged.
- [ ] Read the existing indexing tracker only; do not resubmit the sitemap or repeatedly inspect URLs.
- [ ] Open a draft PR to `site-rebuild-v2`; do not merge or deploy to production.
