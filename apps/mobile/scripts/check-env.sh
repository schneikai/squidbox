#!/usr/bin/env bash
# Verify the env needed to build/preview the app from a cloud workspace.
# Creates .env.local from the environment when it's missing (write-env-local.sh); otherwise it only
# tells you what's missing and where to get it. Exits 1 only when the dev client can't run.
set -u
cd "$(dirname "$0")/.."

miss=0
eas_miss=0
note() { printf '  - %s\n' "$1"; }
check_var() {
  local name="$1" hint="$2"
  if [ -z "${!name:-}" ]; then
    eas_miss=1
    printf 'MISSING %s\n' "$name"
    note "$hint"
  else
    printf 'ok: %s set\n' "$name"
  fi
}

has_env_local_var() { grep -qE "^$1=.+" .env.local; }

echo "== dev client env (.env.local) =="
[ -f .env.local ] || scripts/write-env-local.sh
if [ ! -f .env.local ]; then
  miss=1
  echo "MISSING .env.local"
  note "set the .env.local.example variables in the environment and re-run, or restore the file from your password manager"
else
  echo "ok: .env.local present"
  if has_env_local_var EXPO_PUBLIC_API_URL; then
    echo "ok: EXPO_PUBLIC_API_URL set"
  else
    miss=1
    echo "MISSING EXPO_PUBLIC_API_URL in .env.local"
    note "an API URL the phone can reach: the live backend, or the local backend through Metro's tunnel"
  fi
fi

echo
echo "== EAS build env (export before eas build; not needed for Metro or the web preview) =="
check_var EXPO_TOKEN          "expo.dev -> Settings -> Access tokens"
check_var EAS_BUILD_PROFILE   "development | preview (matches the profile you pass to eas build)"
check_var EXPO_ASC_API_KEY_PATH "path to the App Store Connect .p8 (needed only for credential setup/repair); decode EXPO_ASC_P8_BASE64 into AuthKey_<KEY_ID>.p8 if it's set"
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
    eas_miss=1
    echo "MISSING file at EXPO_ASC_API_KEY_PATH=$EXPO_ASC_API_KEY_PATH"
    note "restore the .p8 from your password manager (downloadable only once from App Store Connect)"
  fi
fi

echo
echo "== app secrets in EAS (preview/production builds) =="
echo "Run: eas env:list --environment preview  -> confirm EXPO_PUBLIC_API_URL, EXPO_PUBLIC_OPENAI_API_KEY, SENTRY_AUTH_TOKEN exist."
echo "Set/update via: eas env:set --name <NAME> --value <value> --visibility secret --environment preview --environment production"

echo
if [ "$eas_miss" -eq 1 ]; then
  echo "RESULT eas build: missing items above. Export them before eas build."
else
  echo "RESULT eas build: all set."
fi
if [ "$miss" -eq 1 ]; then
  echo "RESULT dev client: missing items above. Metro would serve a bundle without its env."
  exit 1
fi
echo "RESULT dev client: all set. Metro and the web preview can start."
