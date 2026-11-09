# Da HoodFarmer website

Production site: https://dahoodfarmer.com

This repository contains the public website source and Cloudflare Pages Functions.

## Architecture
- Cloudflare Pages serves the static website from `public/`.
- Cloudflare Pages Functions live in the repository-root `functions/` directory and provide API routes.
- Cloudflare D1 (`dahoodfarmer-db`) stores contact submissions, booking requests, newsletter subscriptions, and commerce records.
- Cloudflare KV binding `SESSIONS` supports rate limiting.
- Cloudflare Turnstile protects public forms.
- Optional email notifications use Resend when its production secrets are configured.

## Main routes
- `/` — homepage
- `/contact` — contact form (`POST /api/contact`)
- `/booking` — booking inquiry form (`POST /api/booking`)
- Newsletter signup — footer/homepage (`POST /api/newsletter`)
- `/admin` — protected administration interface (Cloudflare Access)

## Development and deployment
The Pages output directory is `public`. The `functions/` directory remains at the repository root so Pages can build its Functions alongside the static assets. Cloudflare Pages should deploy the `site-rebuild-v2` production branch.

Use the existing Wrangler configuration and a non-production local D1 database for local development. Never run local test submissions against the production database.

## Database
- `schema.sql` documents the full D1 schema.
- `migrations/` contains ordered D1 migrations.
- Apply migrations to production only after reviewing the target database and confirming the migration is appropriate. The migration in this change creates the bookings and newsletter tables only when absent; it does not drop tables or delete records.

## Security and secrets
- Keep `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, Stripe secrets, and other private values in Cloudflare Pages Production secrets.
- Never commit secret values or paste them into chat.
- Public static assets are copied into `public/`; repository configuration, source SQL, and documentation are not part of the Pages output.
- Root `_headers` and `_redirects` are mirrored into `public/` so Cloudflare Pages applies them to deployed assets.
