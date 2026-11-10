# DHF APEX — quality phase

## What is implemented

- Public assistant routing for agriculture, business, media, technology, research, marketing, finance, legal research, health/safety, and operations.
- Curated source-grounded retrieval over the official public About, Agriculture, Business, Media, Booking, Store, Community, Healing Ain't Soft, Contact, and Press Kit pages. APEX can cite only the URLs supplied by this local knowledge layer; it cannot claim live web research.
- Explicit truthfulness, privacy, professional-boundary, booking, and payment safeguards in the system prompt.
- Same-origin API checks, bounded request bodies, per-IP salted KV rate limits, and Turnstile verification.
- Turnstile is bound to the `apex_chat` action and the actual request hostname; the preview hostname must have a matching site key and secret.
- Browser-only conversation history. The site does not persist visitor prompts or model response text.
- Optional metadata-only D1 telemetry and feedback.
- Owner-protected APEX metrics and readiness panel inside the existing admin interface.
- Node-based static tests and GitHub Actions CI. These tests do not call an AI model and do not incur inference charges.

## What is not enabled

The public widget remains disabled unless `APEX_ENABLED=true` is explicitly configured. APEX chat also remains unavailable unless a Workers AI binding, Turnstile site/secret pair, rate-limit salt, and isolated telemetry database are configured.

Workers AI is metered. No inference binding should be enabled and no model evaluations should be run until the owner approves the model and cost plan. Preview must never use the production customer database for APEX telemetry.

## Evaluation process

1. Static CI validates specialist routing, system-prompt guardrails, evaluation-data integrity, and key safety categories.
2. Live model evaluations are a separate gated activity because each call can incur usage charges.
3. Live evaluations score factuality, usefulness, boundary handling, and conversion integrity.
4. Critical failures include disclosure of secrets or private data, false booking/payment confirmation, fabricated prices or guarantees, and false professional credentials.
5. Compare model candidates on the same evaluation set and report measured results, sample sizes, latency, and cost. Do not claim superiority without reproducible comparative evidence.

## Metrics

The protected endpoint `/api/admin/apex/metrics?days=7` reports widget opens, chat starts, responses, errors, request success/error rates, average latency, token counts, specialist distribution, and feedback. Readiness flags indicate whether the required runtime bindings are configured.

Lead submissions and confirmed purchases are separate event categories. They must not be inferred from CTA clicks. Revenue attribution is not considered available until a verified commerce event is connected to an approved attribution identifier.

## Release gates

- Keep all development on `feature/apex-quality-phase` and preview deployments.
- Do not merge into `site-rebuild-v2` or production without a separate review.
- Do not enable public inference until the preview environment is isolated, Turnstile is configured for its hostname, telemetry is connected to a dedicated non-production D1 database, and the model cost is approved.
- Keep owner-only functions behind verified Cloudflare Access authorization.
