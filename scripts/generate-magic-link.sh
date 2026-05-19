#!/usr/bin/env bash
# Generate a Supabase magic link via the admin API — no email round-trip.
# Useful when:
#   - You've hit Supabase's email rate limit
#   - You want to sign in as another user for local testing
#   - You want a magic link that doesn't require PKCE same-context exchange
#
# Usage:  ./scripts/generate-magic-link.sh <email>
# Output: the action_link you can paste straight into any browser.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <email>" >&2
  exit 2
fi

EMAIL="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env
set -a
# shellcheck disable=SC1090
. "${REPO_ROOT}/.env"
set +a

REDIRECT_TO="${2:-http://localhost:3000/auth/callback}"

resp=$(curl -sS -X POST "${SUPABASE_URL}/auth/v1/admin/generate_link" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "type": "magiclink",
  "email": "${EMAIL}",
  "options": { "redirect_to": "${REDIRECT_TO}" }
}
EOF
)")

# Try jq first, fall back to python.
if command -v jq >/dev/null 2>&1; then
  link=$(echo "$resp" | jq -r '.properties.action_link // .action_link // empty')
  err=$(echo "$resp" | jq -r '.error_description // .msg // .error // empty')
else
  link=$(echo "$resp" | /usr/local/bin/python3.12 -c "import json,sys; d=json.load(sys.stdin); print(d.get('properties',{}).get('action_link') or d.get('action_link') or '')")
  err=$(echo "$resp" | /usr/local/bin/python3.12 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error_description') or d.get('msg') or d.get('error') or '')")
fi

if [ -z "$link" ]; then
  echo "Failed to generate link." >&2
  echo "$err" >&2
  echo "Raw response: $resp" >&2
  exit 1
fi

echo "$link"
