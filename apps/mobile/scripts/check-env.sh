#!/usr/bin/env bash
# Verify the env needed to build/preview the app from a cloud workspace.
# Does not handle secrets itself — it tells you what's missing and where to get it.
set -u

miss=0
note() { printf '  - %s\n' "$1"; }
check_var() {
  local name="$1" hint="$2"
  if [ -z "${!name:-}" ]; then
    miss=1
    printf 'MISSING %s\n' "$name"
    note "$hint"
  else
    printf 'ok: %s set\n' "$name"
  fi
}

echo "== dev client env (.env.local) =="
if [ ! -f .env.local ]; then
  miss=1
  echo "MISSING .env.local"
  note "cp .env.local.example .env.local  then fill values from your password manager / EAS"
else
  echo "ok: .env.local present"
  check_var NGROK_AUTHTOKEN "ngrok dashboard -> Your Authtoken (needed by tunnel.js for the dev client tunnel)"
fi

echo
echo "== EAS build env (export before eas build) =="
check_var EXPO_TOKEN          "expo.dev -> Settings -> Access tokens"
check_var EAS_BUILD_PROFILE   "development | preview (matches the profile you pass to eas build)"
check_var EXPO_ASC_API_KEY_PATH "path to the App Store Connect .p8 (needed only for credential setup/repair)"
check_var EXPO_ASC_KEY_ID     "App Store Connect -> Users and Access -> Integrations -> Team Keys"
check_var EXPO_ASC_ISSUER_ID  "App Store Connect API issuer id"
check_var EXPO_APPLE_TEAM_ID  "developer.apple.com -> Membership"
check_var EXPO_APPLE_TEAM_TYPE "INDIVIDUAL (usually)"

echo
echo "== Apple API key file =="
if [ -n "${EXPO_ASC_API_KEY_PATH:-}" ]; then
  if [ -f "$EXPO_ASC_API_KEY_PATH" ]; then
    echo "ok: $EXPO_ASC_API_KEY_PATH exists"
  else
    miss=1
    echo "MISSING file at EXPO_ASC_API_KEY_PATH=$EXPO_ASC_API_KEY_PATH"
    note "restore the .p8 from your password manager (downloadable only once from App Store Connect)"
  fi
fi

echo
echo "== app secrets in EAS (preview/production builds) =="
echo "Run: eas secret:list  -> confirm EXPO_PUBLIC_API_URL, EXPO_PUBLIC_OPENAI_API_KEY, SENTRY_AUTH_TOKEN exist."
echo "Push/update via: eas secret:push --scope project --env-file .secrets [--force]"

echo
if [ "$miss" -eq 1 ]; then
  echo "RESULT: missing items above. Fill them from your vault/EAS, then re-run."
  exit 1
fi
echo "RESULT: all set."
