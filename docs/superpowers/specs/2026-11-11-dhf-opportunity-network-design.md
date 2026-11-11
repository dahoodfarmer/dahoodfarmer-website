# DHF Opportunity Network Design

**Date:** 2026-11-11  
**Repository:** `dahoodfarmer/dahoodfarmer-website`  
**Build branch:** `feature/dhf-opportunity-network-build`  
**Parent:** PR #19 head `7a94c054fa51ce257381d7e576f63dc67c2a73a7`  
**Target after review:** `site-rebuild-v2` (through a stacked draft PR; do not merge)

## Intent

Turn dahoodfarmer.com into the central commercial platform for the Da HoodFarmer brand and the DHF Opportunity Network. The platform should attract businesses, vendors, sponsors, educators, creators, and property partners, then convert interest into structured applications that the owner can review and approve.

The network has five connected funnels:

1. DHF Business Network — business profiles, directory listings, exposure and partnerships.
2. DHF Summit & Events — summits, workshops, festivals, exhibitors and sponsors.
3. DHF Marketplace — vendors, makers, agricultural producers and product showcases.
4. DHF Academy — workshops, training and educational program interest.
5. DHF Land & Experiences — property owners, agritourism, retreats, outdoor education and event locations.

The platform serves customers and partners across all 50 U.S. states and accepts international inquiries where delivery, legal compliance, payment and logistics make the opportunity viable.

## Goals

- Create five crawlable, mobile-first funnel pages with clear calls to action.
- Capture vendor, sponsor, business-listing, speaker, academy and property-partner applications in one consistent intake system.
- Store applications in D1 and protect public submissions with Turnstile and KV rate limits.
- Give the owner a Cloudflare Access-protected application review workflow.
- Publish only owner-approved business listings, and only when the applicant separately consents to public display.
- Record source page, country and state/region so national and international demand can be measured.
- Preserve existing contact, booking and newsletter behavior.
- Prepare a payments-ready architecture without accepting live payments or activating production checkout.
- Use the existing Cloudflare Pages + Pages Functions + D1 + KV architecture; no separate VPS, container, paid SaaS form service or duplicate AI/payment system.
- Keep all changes in Preview and a draft PR until owner review.

## Non-goals for this phase

- No Production deployment, merge, DNS changes, domain routing changes, or Production database/schema changes.
- No live charges, subscriptions, deposits, bookings, invoices or payment collection.
- No paid Cloudflare products, plan upgrades, subscriptions or external vendor commitments.
- No automatic approval or public publication of applicant data.
- No purchase or lease of property and no commitments on behalf of landowners or event venues.
- No claims of government accreditation or third-party certification.
- No prospect outreach, application submission to third parties, or legal/financial commitments.
- No file-upload pipeline in the first release; R2 is a later option after the need and cost controls are verified.

## Approaches considered

### A. Extend the existing Pages/Workers/D1/KV stack (recommended)

Use one typed application intake endpoint and one D1 application table, then build owner review and an approved-listings layer. Static funnel pages remain in Pages; Pages Functions handle validation and data access.

**Trade-offs:** Requires a small amount of custom application and admin code, but preserves customer data ownership, has no new platform subscription, reuses Turnstile/Access, and avoids migration.

### B. Add an external form builder and directory SaaS

Would shorten initial form setup but introduces a second customer-data store, potential recurring fees, platform dependencies, and synchronization work.

**Decision:** Reject for the free-first requirement and owner-control preference.

### C. Move the site to a separate server or full-stack hosting platform

Would provide more infrastructure choices but duplicates the existing Cloudflare serverless runtime and adds deployment, security and maintenance complexity.

**Decision:** Reject. Pages Functions already provide server-side API execution.

## Architecture

### Public experience

- Rework the existing `/business` page as DHF Business Network.
- Add `/summits`, `/marketplace`, `/academy`, and `/experiences`.
- Add a public `/business-directory` page that reads only approved, active listings.
- Add a `/sponsors` page for sponsor information and an application CTA.
- Add consistent navigation/footer links, sitemap entries, metadata, and internal links.
- Do not publish illustrative prices as actual offers. Use application/request-a-prospectus language until the owner approves actual packages and prices.
- Do not promise dates, venues, inventory, certification, guaranteed audience reach, or services that have not been secured.

### Application intake

Create `POST /api/opportunity-application` with allowed application types:

- `business_listing`
- `vendor`
- `sponsor`
- `speaker`
- `academy`
- `property_partner`
- `membership`

Common fields: applicant name, email, organization/business name, website, country, state/region, city, category, requested opportunity/package, event/program interest, preferred date (optional), message/description, contact consent, optional marketing consent, optional public-listing consent, and source page.

Data-minimization rules:
- Require consent to be contacted about the submitted application.
- Keep marketing consent separate and optional.
- Keep public-listing consent separate and optional.
- Never publish email, phone, private application details, or an unapproved listing.
- Do not collect payment card data, government IDs, Social Security numbers, or unnecessary sensitive information.
- Accept international country/region text without limiting applications to U.S. states.
- Validate and normalize all input server-side; enforce length limits and an allowlist of application types.
- Use Turnstile server-side Siteverify and KV rate limiting before writing to D1.
- Store only the source pathname, not arbitrary referrer query strings or tracking secrets.

### D1 data model

Add an additive migration for:
- `opportunity_applications`: private application records, status, consent flags, source path, country/region, timestamps, and application details.
- `business_listings`: public business profile fields, source application ID, approval/publish status, country/region, category, website, and timestamps.

Only an admin action may transition an application to approved. A listing is created or published only for `business_listing` applications with explicit public-listing consent. Hiding or rejecting an application must not expose its private data.

### Owner administration

Extend the existing `/admin` dashboard, already protected by Cloudflare Access and an API JWT-verifying middleware, to show:
- Application counts by type and status.
- Paginated recent applications.
- Applicant details and consent states.
- Status transitions (new, reviewing, contacted, approved, declined).
- Approved business listing publication only when public-listing consent is true.

All admin APIs remain under `/api/admin/*` so the existing Access JWT middleware protects them. Public directory API returns only approved fields and never private applicant data.

### Payments and communications

- Reuse the existing payment-engine work in PR #17 only after separate code/security review and owner approval for any live payment activation.
- Reuse the existing APEX work in PR #18 only after its security, database isolation and inference-cost gates are satisfied. Do not duplicate AI.
- Reuse optional Resend notification work in PR #15 only after sender verification and owner approval to configure credentials.
- Application intake must succeed or fail based on D1 save and spam validation, not on optional email delivery.
- No live payment methods or pricing are activated in this phase.

## Cloudflare capability policy

Keep Pages, Pages Functions/Workers, D1, KV, Turnstile and Access. The project-wide Preview D1/KV defaults are now isolated from Production. Do not use older Preview deployments whose snapshots still reference Production resources.

Evaluate R2 for future file uploads, Images Free transformations for image optimization, Web Analytics for privacy-first measurement, Queues/Workflows for later background processing, Durable Objects for later stateful real-time sessions, Workers AI/AI Gateway/AI Search for the existing APEX roadmap, and Stream/Realtime only when a real video/live-media requirement and funding plan exist.

Do not activate paid services, incur usage beyond included free allocations, upgrade plans, or enable production-impacting features without owner approval. Beta/preview features require eligibility, maturity, compatibility, cost and rollback review before use.

## International and legal/operational guardrails

- Intake is open to all U.S. states and international inquiries.
- The application must ask for country and state/region, not infer location from IP.
- Any later sale, event, training, property experience, or shipment must be checked for destination-specific taxes, privacy/consumer-protection requirements, payment support, shipping, licensing, insurance, zoning and safety.
- Keep privacy and terms language aligned with actual data collection and services. This design is not legal advice.
- Paid editorial placements and sponsorships must be clearly disclosed; no payment may imply independent editorial endorsement.
- The business directory must display only applicant-approved public profile information.

## Success criteria

- Five funnel pages and sponsor page load from the Pages Preview.
- All application types validate and store in the isolated Preview D1 database.
- Invalid payloads, missing consent, missing/invalid Turnstile tokens, and rate-limited requests are rejected.
- Applications appear only in the Access-protected admin view.
- Public directory API exposes only approved listings with explicit publication consent.
- Sitemap, navigation, metadata, mobile layout, and accessibility basics are checked.
- Existing contact, booking and newsletter paths remain unchanged.
- CI and Preview deployment checks pass on the exact build-branch commit.
- Production branch, Production D1/KV, DNS, Access policies and live payments remain unchanged.
