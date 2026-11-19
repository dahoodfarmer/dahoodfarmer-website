# Preview Contact and Booking Form Test Plan

**Scope:** Cloudflare Pages Preview for `feature/loopy-carter-dual-identity` only.  
**Production:** Out of scope. Do not submit test data to the Production domain or Production database.

## Preconditions

- Open the latest successful Preview deployment through the branch alias:
  `https://feature-loopy-carter-dual-id.dahoodfarmer-website.pages.dev`
- Sign in through the site's existing Cloudflare Access gate if prompted.
- Confirm the address bar remains on the `pages.dev` Preview host.
- Confirm the Cloudflare Turnstile challenge is visible on both forms. The Preview branch alias is now on the widget's allowed-domain list, and the server-side expected hostname is aligned to that alias.
- The Preview `TURNSTILE_SECRET_KEY` secret entry exists, but Cloudflare masks its value; a successful challenge submission is the end-to-end validity check.
- Use only synthetic test details. Do not enter a real person's name, phone number, email, address, or event details.
- Do not repeat submissions rapidly: each endpoint is limited to five requests per IP per 60 seconds.

## Test A — Contact form

1. Open `/contact`.
2. Enter:
   - Name: `Preview QA Test`
   - Email: `preview-test@example.com`
   - Category: `General Inquiry`
   - Message: `Synthetic Preview QA test. No response is required.`
3. Complete the Turnstile challenge.
4. Submit once.
5. Record the visible result and time. Expected: the page displays the success confirmation.
6. Verify that exactly one corresponding row was written to the **Preview D1** `contacts` table. Do not inspect or copy the submitted IP address.
7. Verify that the Production D1 database did not change.

## Test B — Booking form

1. Open `/booking`.
2. Enter:
   - Name: `Preview QA Test`
   - Email: `preview-test@example.com`
   - Organization: `Preview QA`
   - Inquiry type: `Speaking Engagement`
   - Preferred date: `2026-12-01`
   - Details: `Synthetic Preview QA test only. This is not a real booking.`
3. Complete the Turnstile challenge.
4. Submit once.
5. Record the visible result and time. Expected: the page displays the booking-received confirmation.
6. Verify that exactly one corresponding row was written to the **Preview D1** `bookings` table. Do not inspect or copy the submitted IP address.
7. Verify that the Production D1 database did not change.

## Negative and security checks

- On each form, attempt submission with a required field blank. Expected: browser validation blocks submission and no row is written.
- Confirm that the Turnstile challenge must be completed before a submission is accepted.
- Confirm that server-side Turnstile verification rejects both a mismatched hostname and a successful provider response that omits the hostname when `EXPECTED_HOSTNAME` is configured.
- Confirm that a failed/expired challenge displays a clear error and does not create a D1 row.
- Confirm that invalid email or unsupported booking type is rejected by the server (HTTP 422) when tested with a valid challenge token.
- Confirm that repeated requests are rate-limited (HTTP 429) after the configured threshold; do not deliberately generate a burst during the owner walkthrough.
- Check that responses do not echo private form contents or IP addresses.

## Email notification status

The site currently has a notification recipient configured, but the Pages project does not list the Resend API-key or sender-address variables required by the current notification code. Until those are configured, a successful form response confirms the D1 save; it does **not** confirm an email alert was delivered. The code intentionally keeps the form submission even when notification delivery is unavailable.

No email provider account, paid service, or new secret should be added without the owner's explicit approval.

## Evidence to record

| Check | Result |
|---|---|
| Preview host and Access login | Pending |
| Preview hostname allowlist and server check aligned | Complete |
| Contact Turnstile renders | Pending |
| Contact success + Preview D1 row | Pending |
| Booking Turnstile renders | Pending |
| Booking success + Preview D1 row | Pending |
| Invalid/expired challenge rejected | Pending |
| Server-side validation | Pending |
| Production database unchanged | Pending |
| Email notification | Not configured; owner decision required |

## Cleanup

After the test results have been verified, remove only the two synthetic test rows from the **Preview D1** database. Do not run cleanup against Production. Preserve the test outcome evidence without retaining unnecessary personal data.
