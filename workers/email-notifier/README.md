# Private website email notifier

This Worker is the email-sending component for the Pages website. Pages Functions do not expose the native Email Service sending binding in their supported binding list, so Pages calls this Worker through a private Service binding.

## Safety model

- No public `workers.dev` endpoint or route is configured.
- The `send_email` binding is restricted to the owner's verified destination address.
- The sender is restricted to `website@notify.dahoodfarmer.com`.
- Only Contact and Booking notifications are accepted.
- Submitted values are HTML-escaped and length-limited.
- No IP address is sent or logged.
- The Pages form handler saves to D1 before attempting notification. Email failure does not discard the saved form record.
- Preview and production use separate Worker service names.

## Required Cloudflare setup

1. Confirm `hoodfarmer202@gmail.com` remains a verified Email Routing destination.
2. Onboard the dedicated sender domain `notify.dahoodfarmer.com` in Cloudflare Email Service.
3. Review the exact SPF, DKIM, DMARC, and bounce DNS records Cloudflare proposes. Do not overwrite existing root-domain MX, SPF, or DKIM records.
4. Confirm the current Cloudflare account allows sends to the already-verified destination without a Workers Paid upgrade. If it asks for a paid plan, stop; do not upgrade.
5. Deploy the Preview Worker first:
   `npx wrangler deploy --config workers/email-notifier/wrangler.toml --env preview`
6. Test one synthetic Contact submission and one synthetic Booking submission on Pages Preview. Confirm both notifications arrive.
7. Do not deploy the production Worker or merge the Pages production binding until the owner approves the final release.

## Deployment commands

From the repository root, with Wrangler authenticated to the owner's Cloudflare account:

```sh
npx wrangler deploy --config workers/email-notifier/wrangler.toml --env preview
```

Production deployment is intentionally not part of this checklist. It requires a separate owner release approval.
