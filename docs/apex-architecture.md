# DHF APEX — first release architecture

## Scope
The first release adds a public-facing, mobile-responsive assistant to the existing Cloudflare Pages website. It uses Cloudflare Workers AI through the Pages Functions `AI` binding, the existing `SESSIONS` KV namespace for short-lived rate limits, and an optional dedicated `APEX_DB` D1 binding for privacy-minimized telemetry.

## Current model
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` is the initial model adapter. The adapter is isolated in `functions/lib/apex.js` so it can be replaced or routed to other models later. Model quality must be measured on the APEX evaluation set; model size or marketing claims are not evidence of superiority.

## Security
- Same-origin POST requests only.
- Cloudflare Turnstile server-side verification required for AI requests.
- Short-window per-IP rate limit using a salted SHA-256 hash stored in KV.
- Request body and message size limits.
- Only user/assistant conversation history is accepted; client-supplied system roles are discarded.
- No tools, purchases, bookings, admin operations, or external web access in this public release.
- No API keys or secrets are committed to the repository.
- The API returns a safe generic error; detailed provider errors remain server-side.

## Privacy
- Conversation history is held in browser memory only.
- The application does not persist prompts or model responses.
- Optional D1 telemetry stores random conversation IDs, event types, specialist category, model name, status, latency and token counts.
- Optional feedback stores a rating and category, not free-text comments.
- Do not enable telemetry until the dedicated APEX D1 database is bound to `APEX_DB`. Do not point it at the production customer database.

## Required Preview-only configuration
1. Configure a Workers AI binding named `AI` for the Pages Preview environment only. In Pages, this binding is configured in the Cloudflare dashboard.
2. Ensure Preview has a matching Turnstile site key and secret. Never copy or expose secret values in Git.
3. Configure a secret named `APEX_RATE_LIMIT_SALT` for Preview.
4. Bind a dedicated non-production D1 database as `APEX_DB`; apply `migrations/0004_apex_analytics.sql` to that database only.
5. Keep Production without the `AI` and `APEX_DB` bindings until the owner approves a production launch after Preview verification and cost review.

## Cost control
Workers AI is usage-priced. This code does not make inference requests unless the `AI` binding is present and a visitor submits a message. Keep Preview access controlled and limit test messages. Review current model pricing before enabling the binding. No paid service or model use is authorized by this code change alone.

## Analytics
The protected endpoint `/api/admin/apex/metrics?days=7` returns response counts, successful/error counts, average latency, token totals, specialist distribution and feedback. It does not measure all website traffic or attributable revenue. Use existing first-party site analytics for visitor/session metrics and connect a verified commerce source before claiming revenue attribution.

## Next releases
- Add source-grounded retrieval over approved public site content.
- Add an authenticated owner command center with separate authorization and explicit action approvals.
- Add a reproducible evaluation suite covering accuracy, usefulness, prompt injection, data boundaries, and task completion.
- Add privacy-safe funnel events and verified commerce attribution.
- Add optional web research tools with citations and explicit freshness indicators.
- Add a multi-model router only after comparative testing shows a measurable quality/cost benefit.
