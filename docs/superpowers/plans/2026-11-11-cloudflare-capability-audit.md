# Cloudflare Capability Audit — Da HoodFarmer

Date: November 11, 2026  
Scope: dahoodfarmer.com, Cloudflare Pages project `dahoodfarmer-website`, existing Workers/Pages Functions, D1, KV, Turnstile, Access, analytics and future media/commerce needs.

## Operating constraints

- Free-first. No paid subscriptions, paid add-ons, billing changes or resource commitments without explicit approval.
- No Production deployment, DNS change, Production database/schema mutation, secret rotation or Access-policy change as part of this audit.
- Prefer features that materially improve reliability, security, performance, analytics or revenue capability.
- Do not activate overlapping AI, email, analytics or storage services just because they exist.
- Re-check current pricing and plan eligibility before activating any beta or usage-billed product.

## Current inventory — verified or already present

| Capability | Current state | Decision |
|---|---|---|
| Cloudflare Pages | Existing production and Preview deployments | Keep as primary web host |
| Pages Functions / Workers runtime | Existing API routes and middleware | Keep; this is the server layer |
| D1 | Production DB plus isolated Preview DB | Keep; new Opportunity Network schema applied only to Preview |
| Workers KV | Existing sessions/rate-limit namespace and isolated Preview KV | Keep |
| Turnstile | Existing forms widget | Keep; active request hostname is now checked dynamically |
| Cloudflare Access | Existing protection for admin and admin APIs | Keep; do not weaken or bypass |
| DDoS protection | Cloudflare edge protection | Keep enabled |
| Cloudflare Web Analytics | Existing RUM site; auto-install enabled; EU-exclusion/lite mode enabled | Keep; no duplicate beacon |
| GitHub integration | Existing branch-based Preview deployments | Keep; PRs remain unmerged |
| Stripe payment engine (PR #17) | Test-mode foundation with separate `PAYMENTS_DB`; Preview `DB`/`SESSIONS` isolation was corrected in this work | Keep test-only; checkout remains disabled until matching test publishable key and full product catalog exist |
| Cloudflare CDN/cache | Pages served through Cloudflare edge | Keep; verify cache rules and headers during QA |
| R2 | Not enabled in the account | Defer until uploads, media library or downloadable products require object storage |
| Cloudflare Images | Not currently integrated | Evaluate after asset inventory and image-performance review |
| Cloudflare Stream | Not integrated | Defer; media delivery is usage-priced |
| Zaraz | Available but not currently configured for this site | Evaluate for tag management and consent before advertising expands internationally |
| WAF custom/managed rules | No site-specific managed ruleset confirmed in current review | Review after Preview QA; no blind Production activation |
| Cloudflare Email Service | Not configured | Compare with existing Resend integration before adopting |
| Workers AI / AI Gateway / Vectorize / AI Search | No need to duplicate the existing APEX AI direction | Evaluate only for a defined workload and verified cost |
| Queues / Workflows / Durable Objects | Not currently needed for current application intake | Reserve for asynchronous work, event workflows, live chat/booking or real-time services |
| Browser Rendering / Containers / Hyperdrive | No current workload requires them | Defer |

## Implemented in this development branch

- Added shared Opportunity Network application intake with server-side validation, Turnstile, rate limiting and D1 persistence.
- Added additive Preview D1 tables for private applications and separately approved public business listings.
- Added protected admin review APIs and owner dashboard controls.
- Added public directory API that returns an explicit public-field allowlist only.
- Added five funnel pages, sponsor inquiry page and business directory.
- Updated privacy and terms content for applications, consent and international inquiries.
- Updated CSP to permit the already-configured Cloudflare Web Analytics beacon.
- Changed form handlers to validate Turnstile against the active request hostname rather than a stale Preview hostname.

## Prioritized next actions

### P0 — finish current Preview QA
1. Confirm the latest Pages deployment is successful and uses Preview D1/KV, never Production.
2. Verify the Preview Turnstile secret binding is present using metadata only; never retrieve its value.
3. Verify latest-head tests and deployment checks. Do not claim a queued CI run passed.
4. Review the admin application queue, public directory response, mobile layout and form error states without creating unnecessary test records.
5. Keep PR #19 and draft PR #20 open and unmerged.

### P1 — free or already-included improvements
1. Review cache-control headers, compression, HTTP/3, Early Hints and image loading. Apply only low-risk code-level improvements in Preview.
2. Review free WAF/custom-rule options and bot controls; stage any rule changes separately because they can affect real visitors and forms.
3. Keep Cloudflare Web Analytics active. Current EU-exclusion mode means analytics coverage is not global even though the website accepts international inquiries.
4. Evaluate Zaraz as the future single control point for GA4, AdSense and consent management. Do not duplicate existing tags; migrate only after a Preview/test plan and pricing check.

### P2 — activate only when a concrete revenue feature needs it
- **R2:** customer uploads, digital downloads, sponsor assets, vendor documents, media storage.
- **Images:** responsive image delivery and transformations after the image inventory is known.
- **Stream:** paid video hosting, recorded workshops, member content or live-event video; requires a budget and usage forecast.
- **Queues / Workflows:** reliable background email, event follow-up, sponsor fulfillment and multi-step application processing.
- **Durable Objects:** live chat, event presence, reservation inventory or synchronized interactive experiences.
- **Email Service:** evaluate beta limitations and recipient rules against the existing Resend implementation.
- **AI Gateway / Workers AI / Vectorize / AI Search:** only if APEX or the directory needs a specific Cloudflare-hosted AI/search workload. Avoid overlapping AI systems and verify any upcoming billing transition before activation.
- **Browser Rendering / Containers / Hyperdrive:** only for a defined document-generation, heavy-compute or external-database requirement.

## Explicit exclusions

- No R2 bucket creation, Stream activation, paid Images/AI/Email features, Workers Paid upgrade or other billing action in this phase.
- PR #17 Preview now binds `DB` to `dahoodfarmer-preview-db`, `SESSIONS` to `dahoodfarmer-preview-sessions`, and `PAYMENTS_DB` to `dahoodfarmer-payments-test`; Production remains without `PAYMENTS_DB`. The Preview metadata does not include `STRIPE_PUBLISHABLE_KEY`, so checkout correctly remains unavailable. Secret values were not read.
- No enabling a zone-wide WAF, Bot Fight Mode, Zaraz or cache rule that can alter live traffic without a separate Preview plan and approval.
- No DNS, Access, secret, Production D1 or Production deployment changes.
- No claim that a beta is free or production-ready without checking its current pricing, limits and availability.

## Official Cloudflare references

- [Pages](https://developers.cloudflare.com/pages/)
- [Workers](https://developers.cloudflare.com/workers/)
- [D1](https://developers.cloudflare.com/d1/)
- [Workers KV](https://developers.cloudflare.com/kv/)
- [R2](https://developers.cloudflare.com/r2/)
- [Images](https://developers.cloudflare.com/images/)
- [Stream](https://developers.cloudflare.com/stream/)
- [Web Analytics](https://developers.cloudflare.com/web-analytics/)
- [Zaraz](https://developers.cloudflare.com/zaraz/)
- [Turnstile](https://developers.cloudflare.com/turnstile/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/)
- [WAF](https://developers.cloudflare.com/waf/)
- [Queues](https://developers.cloudflare.com/queues/)
- [Workflows](https://developers.cloudflare.com/workflows/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Vectorize](https://developers.cloudflare.com/vectorize/)
- [Browser Rendering](https://developers.cloudflare.com/browser-rendering/)
- [Email Service](https://developers.cloudflare.com/email-service/)
