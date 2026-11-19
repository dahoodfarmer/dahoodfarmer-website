# Website Release Milestone Tracker

Last updated: November 19, 2026  
Pull request: https://github.com/dahoodfarmer/dahoodfarmer-website/pull/19  
Branch: `feature/loopy-carter-dual-identity`  
Production base: `site-rebuild-v2`

## Release controls

- The owner has authorized in-scope fixes and implementation work for these six release milestones on this feature branch.
- Keep PR #19 open as a **draft** and **unmerged** until the owner completes the visual review and gives a separate release approval.
- Do not deploy to Production, change Production bindings/secrets, or change DNS records as part of routine Preview work.
- No paid email plan, paid add-on, new vendor subscription, or billing change is authorized.
- Use synthetic data only for form testing. Never submit real personal or booking details as test data.
- Do not expose private family details, personal/legal name, unsupported audience statistics, or unverified credentials.

## Milestone 1 — Downloadable PDF media kit

**Status: Draft exists; update and owner approval pending.**

Completed:
- Created a five-page Creator & Media Kit PDF draft for review.
- Included the approved public identities, biography, content pillars, partnership opportunities, official channel links, collaboration process, and contact route.
- Qualified the 88-acre reference as farm experience, not current ownership.
- Described Massanutten as military-academy/cadet leadership, not armed-forces service.
- Omitted private family details, unsupported audience metrics, and invented rates.

Remaining:
1. Owner supplies the exact public business/contact phone number to print.
2. Recheck every biographical claim against the current approved public copy.
3. Keep audience figures out unless fresh native-platform analytics are supplied and dated.
4. Regenerate and inspect the final PDF, including page breaks, links, and phone-number formatting.
5. Obtain owner approval before committing or publishing the PDF.

Do not publish the PDF as a public download until the owner approves it and the hosting method is confirmed.

## Milestone 2 — Email notifications without a paid provider plan

**Status: Cloudflare-native Worker deployed to Preview with public workers.dev access disabled; sender-domain onboarding and actual email test pending.**

Verified account facts:
- The notification recipient already configured for the site is the owner's Gmail address.
- Cloudflare lists that Gmail address as a verified Email Routing destination.
- Email Routing for `dahoodfarmer.com` is active and reports `ready`.
- The former form code used Resend without the required API key or sender variables. That integration has been replaced in the feature branch.
- Pages Functions do not expose a native `send_email` binding in the documented supported subset.

Implementation now staged in the feature branch:
1. Added `workers/email-notifier/` with a private Cloudflare Worker and separate Preview/Production environments.
2. Restricted its `send_email` binding to the verified owner inbox and the dedicated sender `website@notify.dahoodfarmer.com`.
3. Added a Pages Service binding. Preview targets `dahoodfarmer-email-notifier-preview`; the eventual Production target is `dahoodfarmer-email-notifier`.
4. Replaced the Resend HTTP integration in the Contact and Booking handlers with the private Worker call.
5. D1 records are saved before email is attempted. Email failure does not discard a valid submission.
6. The Worker has no public `workers.dev` endpoint or route, accepts only Contact and Booking notifications, escapes HTML, limits field lengths, and does not log submitted content or IP addresses.

Cost and access notes:
- Cloudflare documents sends to verified destination addresses as free on Workers Free or Paid plans. Sending to arbitrary, unverified recipients requires Workers Paid.
- The sender domain must be onboarded for Email Sending. Cloudflare may require SPF, DKIM, DMARC, and bounce-related DNS records.
- The connected Cloudflare API session can read the verified destination and Email Routing status, but Email Sending API calls return an authorization error. Sending-domain onboarding and account sending limits could not be verified from this session.
- The Preview Worker `dahoodfarmer-email-notifier-preview` is deployed in the Cloudflare account. Its `workers.dev` subdomain and preview URLs are disabled, and its send binding is restricted to the verified owner inbox. The Pages Preview Service binding now resolves and the latest confirmed Preview deployment succeeds.
- No email has been sent yet because the sender domain is not confirmed as onboarded. No DNS records, paid plan, external provider account, API token, or Production binding has been applied.

Owner-side checkpoint:
- In Cloudflare, open **Compute & AI → Email Service → Email Sending** and inspect whether the account offers onboarding on the current Free plan.
- If offered, choose the dedicated sender subdomain `notify.dahoodfarmer.com` rather than changing the root mail-routing setup.
- Review the proposed records before saving. Do not overwrite existing root-domain MX, SPF, or DKIM records. If Cloudflare requires a paid plan, stop; do not upgrade.
- Once onboarding is complete, deploy only the Preview Worker using the command in `workers/email-notifier/README.md`, then test one synthetic Contact and one synthetic Booking submission.
- Do not deploy the Production Worker or activate the Production binding until the owner separately approves the final release.
## Milestone 3 — Contact and Booking forms

**Status: Code review and test plan updated; owner end-to-end submissions pending.**

Pre-test:
- Use only the Preview address below. Confirm the browser remains on the `pages.dev` host.
- Sign in through Cloudflare Access if prompted.
- Use the Preview-only `/admin/` dashboard to inspect saved records.
- Do not use the Production domain or Production admin dashboard.

Contact test:
1. Open `/contact`.
2. Name: `Preview QA Test`
3. Email: `preview-test@example.com`
4. Category: `General Inquiry`
5. Message: `Synthetic Preview QA test. No response is required.`
6. Complete Turnstile and submit once.
7. Confirm the visible success message.
8. Open Preview `/admin/` and verify exactly one matching Contact record.

Booking test:
1. Open `/booking`.
2. Name: `Preview QA Test`
3. Email: `preview-test@example.com`
4. Organization: `Preview QA`
5. Inquiry type: `Speaking Engagement`
6. Preferred date: `2026-12-01`
7. Details: `Synthetic Preview QA test only. This is not a real booking.`
8. Complete Turnstile and submit once.
9. Confirm the visible booking-received message.
10. Open Preview `/admin/` and verify exactly one matching Booking record.

After both tests:
- Confirm that the two records appear only in Preview D1.
- Do not copy, display, or retain IP addresses.
- Verify that blank required fields, invalid email/type, and missing/expired Turnstile tokens are rejected without creating records.
- Avoid deliberate high-volume requests; rate limiting is configured.
- Remove only the exact synthetic Contact and Booking rows from Preview after verification. Never run cleanup against Production.
- A successful form message alone does not prove email delivery. Confirm the notification arrives in the owner's inbox after the Cloudflare-native sender is configured.

## Milestone 4 — Owner visual inspection

**Status: Latest Preview deployment succeeds; desktop and phone review pending.**

Preview URL:
`https://feature-loopy-carter-dual-id.dahoodfarmer-website.pages.dev`

Latest confirmed Preview deployment:
- Commit: `b38c795ed98eb3de31f3584c97ec5e4c752b9fab`
- Deployment: `4920a560-00e4-4c79-99f3-7224022986a8`
- URL: `https://4920a560.dahoodfarmer-website.pages.dev`
- Result: Preview build and deploy succeeded; the branch alias below points to the latest Preview deployment.
- GitHub Vercel status for this commit: success.

Desktop pass:
1. Open the Preview URL in a desktop browser and sign in through Cloudflare Access.
2. Review the homepage and shared navigation.
3. Review `/loopy-carter`, `/da-hoodfarmer`, `/about`, `/the-journey`, and `/agriculture`.
4. Review `/media`, `/media-kit`, `/press-kit`, `/photo-archive`, and `/television-gallery.html`.
5. Review `/contact` and `/booking`.
6. Check every image, caption, heading, button, internal link, footer link, and page title. Confirm there are no broken images, clipped sections, overlapping text, unexpected blank areas, or misleading booking promises.
7. Confirm the media kit has no stale follower count and the contact routes work.

Phone pass:
1. Open the same Preview URL on the phone.
2. Check the mobile navigation opens, closes, and routes correctly.
3. Repeat the homepage, profile, media kit, Contact, and Booking checks.
4. Check that text is readable, buttons are tappable, images fit the screen, and no horizontal scrolling is needed.
5. Send screenshots of any issue; do not test forms on Production.

Record issues by page and screenshot. Do not approve release until all blocking issues are fixed and rechecked.

## Milestone 5 — Public content, privacy, and claims review

**Status: Preliminary source audit complete; final owner review pending.**

The current source review covered the homepage, About, Loopy Carter biography, Da HoodFarmer page, media page, online media kit, press kit, Contact, Booking, and agriculture page.

Review standards:
- Keep Loopy Carter and Da HoodFarmer clearly connected without publishing the user's legal name.
- Keep family-history sources distinct: public records are cited as records; family oral history is labeled as oral history.
- Do not publish children's names, identifying details, or private family information.
- Keep the 88-acre figure qualified as farm experience, not current ownership.
- Keep Second Lieutenant qualified as a Massanutten Military Academy cadet rank; do not imply armed-forces service or veteran status for the user.
- Preserve accurate education, recognition, instructor, and television-credit wording. Do not add uncertain dates or unsupported credits.
- Describe developing business ideas as projects, not established operating businesses.
- Do not publish stale audience metrics. The online media kit has been updated to remove its previous user-reported YouTube count; PDF metrics remain omitted until current analytics are provided.
- Contact form language must not promise a response time.
- Booking submission must clearly state it is a request, not a confirmed booking.
- Privacy wording must explain form storage and security-related technical data without exposing operational secrets.

## Milestone 6 — Release authorization

**Status: Not authorized yet; deliberate final gate.**

Before release:
- All six milestones have documented results.
- Latest Preview deployment matches the latest PR head and succeeds.
- CI/status checks are successful.
- Owner completes desktop and phone inspection.
- Owner approves the final PDF, phone number, public copy, and any images.
- Contact and Booking Preview submissions and Preview-only cleanup are complete.
- Email notification behavior is accurately reported and any required free Cloudflare setup is verified.

PR #19 must remain **OPEN, DRAFT, and UNMERGED** until the owner explicitly says to merge and deploy. A separate clear approval is required for Production release. No Production changes are included in this tracker update.


## Remote audit checkpoint — November 19, 2026

- PR #19 remains open, draft, and unmerged. Its latest head is `b38c795ed98eb3de31f3584c97ec5e4c752b9fab`; the Preview deployment above matches that exact commit.
- The Production deployment remains on commit `1d5238a8833ce0ea65a24213b57ed97245a498b7`, deployed November 9, 2026. No Production deployment or configuration change was made during this audit.
- Cloudflare currently lists the Preview email Worker `dahoodfarmer-email-notifier-preview`; the Production Worker `dahoodfarmer-email-notifier` is not present in the account's Worker Script list. The Pages Production environment response also does not show the `EMAIL_NOTIFIER` service binding. Treat Production email as unavailable until separately provisioned and verified.
- The configured sender is `website@notify.dahoodfarmer.com`. The DNS zone currently returns no records for `notify.dahoodfarmer.com`; its TXT records show root-domain SPF/DKIM and Google verification only, with no `_dmarc` TXT record returned. Sender-domain onboarding and authentication remain incomplete. Do not change DNS or create a Production Worker without separate owner approval.
- The privacy policy on this branch now states that no payment processor or payment collection is active. The stale Stripe activation statement was removed to match the approved payment direction.
- Preview remains protected by Cloudflare Access. Owner-authenticated desktop/mobile review and synthetic Contact/Booking end-to-end tests remain outstanding.
- No Production files, bindings, secrets, DNS, databases, payments, or deployments were changed.
