# DHF Opportunity Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build five connected DHF commercial funnels, a public approved-business directory, and a protected application-review workflow on the existing Cloudflare Pages stack.

**Architecture:** Keep static pages in `public/`, Pages Functions in `functions/`, D1 as the source of truth, KV for rate limiting, Turnstile for public intake, and the existing Cloudflare Access middleware for admin APIs. Use one typed application intake endpoint and separate private applications from public approved listings.

**Tech Stack:** HTML, CSS, browser JavaScript, Cloudflare Pages Functions (ES modules), Cloudflare D1, Cloudflare KV, Turnstile, Cloudflare Access, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-11-dhf-opportunity-network-design.md`

## Current status — November 11, 2026

- Draft stacked PR #20: `https://github.com/dahoodfarmer/dahoodfarmer-website/pull/20`.
- Latest verified branch head: `ea8117e33195830d49d31a9db82b24ecbfae925d`.
- Latest Cloudflare Pages Preview deployment: `dde7ca7f-bfd5-40b9-8c5e-512a317a5c23`, successful; branch alias `https://feature-dhf-opportunity-netw-7nbf.dahoodfarmer-website.pages.dev`.
- Preview D1 migration 0004 applied only to `dahoodfarmer-preview-db` (`ca5786b1-751e-4cee-b595-3a4b60061cc9`). Production D1 remains untouched.
- Preview D1/KV isolation verified; Turnstile widget domain list updated to the actual shortened branch alias.
- 35 local tests passed with mocked D1/KV/Siteverify/email dependencies. Latest-head GitHub Actions status remains queued and is not yet a verified pass.
- No live application submissions, production data changes, merges, production deployments, DNS changes, paid services or live payments were performed.
- Browser-level Preview review remains limited by the existing Cloudflare Access boundary; do not bypass Access.

## Global Constraints

- Build branch is `feature/dhf-opportunity-network-build`, based on PR #19 head `7a94c054fa51ce257381d7e576f63dc67c2a73a7`.
- Production branch `site-rebuild-v2` remains untouched; do not merge or deploy Production.
- Pages static output is `public/`; Pages Functions remain in repository-root `functions/`.
- Preview D1 is `dahoodfarmer-preview-db` (ID `ca5786b1-751e-4cee-b595-3a4b60061cc9`) and Preview KV is `dahoodfarmer-preview-sessions` (ID `2218d0643bab47e0b1bd46fd0e473637`).
- Never write to Production D1/KV, expose secrets, change DNS/Access, activate live payments, incur paid usage, or contact prospects.
- All 50 U.S. states and international inquiries remain eligible; country and region are applicant-provided fields.
- Public directory records require owner approval and separate public-listing consent.
- Contact consent is required; marketing consent is optional and separate.
- Do not publish unapproved prices, dates, venues, credentials, audience guarantees, or service commitments.
- Preserve existing contact, booking, newsletter, APEX and payment-engine behavior.

## Review Focus

- Missing or invalid Turnstile token, hostname mismatch, and Siteverify network failure must never create an application.
- Missing contact consent or invalid application type must be rejected before database writes.
- HTML/script injection in applicant fields must remain inert in admin and public directory rendering.
- International values, Unicode names, apostrophes, long strings and empty optional fields must be handled safely.
- Unapproved listings and applicants who decline public display must never appear in the public directory.

---

### Task 1: Application schema and validation

**Files:**
- Create: `migrations/0004_opportunity_network.sql`
- Create: `functions/lib/opportunity.js`
- Modify: `schema.sql`
- Modify: `package.json`
- Create: `tests/opportunity.test.js`

**Interfaces:**
- `validateOpportunityApplication(data, sourcePath)` returns `{ valid, errors, sanitized }`.
- `sanitizeOpportunityApplication(data, sourcePath)` is not separately exported; keep sanitization inside the validator.
- Allowed types: `business_listing`, `vendor`, `sponsor`, `speaker`, `academy`, `property_partner`, `membership`.

- [x] **Step 1: Write failing tests** for every allowed type, unknown types, missing name/email/contact consent, invalid email, oversized fields, Unicode/international region values, optional marketing consent, optional public-listing consent, and source-path normalization.
- [x] **Step 2: Run `npm test`** and confirm the new tests fail because the helper does not yet exist.
- [x] **Step 3: Implement the validator** with strict allowlists, field-specific length limits, normalized email, booleans, and no arbitrary object/HTML persistence.
- [x] **Step 4: Add the additive D1 migration** for `opportunity_applications` and `business_listings`, including status indexes and a unique source-application relation.
- [x] **Step 5: Update `schema.sql`** so local setup matches the migration.
- [x] **Step 6: Run `npm test`** and confirm all local mocked tests pass.

### Task 2: Secure public application endpoint

**Files:**
- Create: `functions/api/opportunity-application.js`
- Modify: `functions/lib/turnstile.js` only if required by the tests.
- Modify: `functions/api/contact.js`, `functions/api/booking.js`, `functions/api/newsletter.js` only if the shared request-hostname validation fix is separately covered and does not alter behavior.

**Interfaces:**
- `POST /api/opportunity-application` accepts the sanitized application fields and `cf-turnstile-response`.
- Use `verifyTurnstile`, `getClientIP`, `checkRateLimit`, `sendSubmissionNotification`, and `env.DB`.
- Application data is inserted with a prepared statement; notification is best-effort only.

- [x] **Step 1: Write failing endpoint tests** for bad JSON, invalid payload, missing consent, missing Turnstile, failed Siteverify, rate limiting, successful insert, and notification failure after successful insert.
- [x] **Step 2: Run tests and verify RED.**
- [x] **Step 3: Implement the endpoint** with a separate rate-limit namespace key and prepared SQL; never accept client-supplied status or approval fields.
- [x] **Step 4: Verify GREEN** with mocked D1/KV and mocked Siteverify responses; no real form submissions or external email sends.

### Task 3: Public directory and protected review APIs

**Files:**
- Create: `functions/api/business-directory.js`
- Create: `functions/api/admin/opportunity-applications.js`
- Create: `functions/api/admin/opportunity-applications/[id].js` or the Pages Functions route form supported by the current repository.
- Create: `functions/api/admin/business-listings.js`
- Modify: `functions/api/admin/stats.js`

**Interfaces:**
- `GET /api/business-directory` returns only approved, active, explicitly public fields.
- `GET /api/admin/opportunity-applications` returns paginated private applications and consent flags.
- Admin status update validates a small status allowlist.
- Approving a `business_listing` application creates or publishes a listing only when public-listing consent is true.

- [x] **Step 1: Write failing tests** for public/private field filtering, pending/declined exclusion, missing publication consent, invalid status changes, pagination bounds, and HTML escaping boundaries.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement public and admin APIs** using prepared statements and existing Access middleware.
- [x] **Step 4: Verify GREEN** with D1 fakes or isolated Preview D1, without reading or changing Production data.

### Task 4: Public funnel pages and shared forms

**Files:**
- Modify: `public/business.html`
- Create: `public/summits.html`
- Create: `public/marketplace.html`
- Create: `public/academy.html`
- Create: `public/experiences.html`
- Create: `public/sponsors.html`
- Create: `public/business-directory.html`
- Modify: `public/forms.js`
- Modify: `public/script.js`
- Modify: `public/styles.css`
- Modify: `public/index.html`
- Modify: `public/sitemap.xml`

**Interfaces:**
- Shared forms declare `data-opportunity-form` and an allowed `data-application-type`.
- Browser form handler posts to `/api/opportunity-application`.
- Directory page reads `/api/business-directory` and safely renders only returned public fields.

- [ ] **Step 1: Add browser-level or DOM-light tests** for form serialization, application type routing, consent checkbox handling and XSS-safe directory rendering.
- [ ] **Step 2: Verify RED.**
- [x] **Step 3: Build responsive funnel pages** with consistent navigation, clear offer, audience, benefits, qualification boundaries and application CTA.
- [x] **Step 4: Extend form handling** without changing the existing contact, booking or newsletter route behavior.
- [x] **Step 5: Update homepage, navigation, footer and sitemap** with canonical paths and metadata.
- [ ] **Step 6: Verify GREEN** with tests and static checks.

### Task 5: Owner application dashboard

**Files:**
- Modify: `public/admin/index.html`
- Modify: `functions/api/admin/stats.js`
- Create or modify admin API route files from Task 3.

**Interfaces:**
- The dashboard fetches applications only from `/api/admin/*`.
- Admin APIs remain protected by `functions/api/admin/_middleware.js` and Cloudflare Access.
- Public listing publication is a separate action from application approval and requires explicit public-listing consent.

- [ ] **Step 1: Write failing tests** for status rendering, no-publication without consent, and safe text rendering.
- [ ] **Step 2: Verify RED.**
- [x] **Step 3: Add application queue, status controls and separate approved-listing controls.**
- [ ] **Step 4: Verify GREEN** and confirm all admin endpoints remain behind Access.

### Task 6: Privacy, terms, SEO and accessibility

**Files:**
- Modify: `public/privacy-policy.html`
- Modify: `public/terms.html`
- Modify: `public/_headers` only if required for new media/form routes.
- Modify: `public/sitemap.xml`
- Modify: `public/robots.txt` only if needed.

- [x] **Step 1: Check every field collected and every public field displayed against the privacy policy.**
- [x] **Step 2: Update data use, contact consent, optional marketing consent, directory publication consent, international inquiry caveats, and no-live-payments status.**
- [ ] **Step 3: Verify page titles, descriptions, canonical URLs, sitemap coverage, keyboard labels, focus states and mobile layout.**
- [ ] **Step 4: Do not present the privacy/terms update as legal advice or a substitute for counsel.**

### Task 7: Preview migration, deployment and verification

**Files:**
- Modify: GitHub workflow only if the current workflow does not run the new test suite.

- [x] **Step 1: Apply migration 0004 only to Preview D1** `ca5786b1-751e-4cee-b595-3a4b60061cc9`; verify the migration's target before execution.
- [x] **Step 2: Commit changes to `feature/dhf-opportunity-network-build` and let Cloudflare Pages create a Preview deployment.**
- [x] **Step 3: Verify Preview deployment uses isolated D1 and KV; verify Turnstile host configuration; do not expose secret values.**
- [ ] **Step 4: Run the exact-head CI checks and inspect the full output.**
- [ ] **Step 5: Verify public pages, form validation, admin Access protection, directory filtering, privacy, SEO, and no Production changes.**
- [x] **Step 6: Open a draft stacked PR targeting `feature/loopy-carter-dual-identity` for owner review. Keep PR #19 open and do not merge either PR.**
