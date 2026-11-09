#!/usr/bin/env bash
# Read-only check: confirm the locally served page received the expected
# Turnstile TEST site key from Wrangler middleware. This performs GET only.
# It does not submit forms, call API endpoints, or touch remote D1/KV.
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8788}"
EXPECTED_KEY="${EXPECTED_TURNSTILE_SITE_KEY:-1x00000000000000000000AA}"
PAGE_URL="${BASE_URL%/}/contact"

if ! command -v curl >/dev/null 2>&1; then
  echo "FAIL: curl is required."
  exit 2
fi

if ! HTML="$(curl --fail --silent --show-error --max-time 10 "$PAGE_URL")"; then
  echo "FAIL: Could not GET $PAGE_URL"
  echo "Start the local Wrangler Pages server first."
  exit 2
fi

INJECTED_KEY="$(printf '%s' "$HTML" |
  grep -oE 'window\.TURNSTILE_SITE_KEY="[^"]*"' |
  head -n 1 |
  sed 's/^window\.TURNSTILE_SITE_KEY="//; s/"$//' || true)"

if [[ -z "$INJECTED_KEY" ]]; then
  echo "FAIL: No non-empty window.TURNSTILE_SITE_KEY was found in the served HTML."
  echo "Check wrangler.local.toml [vars].TURNSTILE_SITE_KEY and middleware injection."
  exit 1
fi

if [[ "$INJECTED_KEY" != "$EXPECTED_KEY" ]]; then
  echo "FAIL: The served page has a different Turnstile site key than expected."
  echo "Expected: $EXPECTED_KEY"
  echo "Received: $INJECTED_KEY"
  echo "Do not submit the form. Correct the LOCAL test configuration first."
  exit 1
fi

echo "PASS: Local /contact HTML contains the expected Turnstile TEST site key."
echo "PASS: This check used GET only; no form submission or database write was attempted."
