---
name: cloud-ios-build
description: Build and preview the Squidbox iOS app from a cloud workspace (no Mac) using an App Store Connect API Key. Use when the user asks to build, preview, or set up a dev client for iOS, or to iterate on the app from the cloud.
---

# Cloud iOS Build (no Mac)

Build and preview the Squidbox iOS app from a cloud workspace. Authenticate Apple with an App Store Connect API Key — no Mac, no Apple ID password, no 2FA (those are blocked from cloud IPs). For an overview of profiles and env, see `README.md` → "Build & preview". This skill covers the headless specifics.

## One-time, per workspace

- `AuthKey_<KEY_ID>.p8` on disk (gitignored via `*.p8`; never commit, never print contents).
- `EXPO_TOKEN` (expo.dev → Settings → Access tokens).
- Apple Team ID, ASC Key ID, ASC Issuer ID — from App Store Connect / developer.apple.com.
- `expect` installed for TTY-driven credential prompts (`apt-get install -y expect`).

Routine builds reuse stored credentials, so the `.p8` is only needed for the one-time credential setup below (or repair).

## Fresh checkout

Runtime app secrets are already in EAS — no action. Restore the non-committed secrets from a password manager:

1. `cp .env.local.example .env.local` and fill values (API URL must be reachable from the phone, not localhost).
2. Set `EXPO_TOKEN`.
3. Restore the `.p8` and set `EXPO_ASC_*` + `EXPO_APPLE_TEAM_*`.
4. Run `scripts/check-env.sh` to verify.

## Env vars (set before every build)

```
EXPO_TOKEN, EAS_BUILD_PROFILE,
EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID,
EXPO_APPLE_TEAM_ID, EXPO_APPLE_TEAM_TYPE=INDIVIDUAL, CI=1
```

The dev client reads `EXPO_PUBLIC_*` from `.env.local` via Metro at runtime (not from EAS). Point it at a reachable API; until the API-in-cloud work lands, use the same reachable API the preview build uses.

## Dev client build

Build commands are in `README.md` → "Building from the cloud". Headless specifics:

- First time on a new bundle id, run `eas credentials:configure-build -p ios -e development`. Its TTY prompts need `expect` in a headless shell. Answer: reuse the distribution certificate (Y), select provisioned devices (defaults fine), generate a new ad-hoc provisioning profile (Y). The existing distribution certificate is reused; only a new profile is created for the `.dev` bundle id.
- Install from the EAS build page (Internal Distribution → Install), then trust the dev certificate in Settings → General → VPN & Device Management.

## Metro + tunnel

Start commands are in `README.md` → "Dev client: Metro + tunnel". **Before starting Metro, run `scripts/check-env.sh` and confirm `.env.local` exists. If it's missing, do NOT start Metro — stop and ask the user for the values.** Without it, Metro serves a bundle with no `EXPO_PUBLIC_*` values and every API call is broken. Before connecting the device, verify the tunnel returns 200:

```
curl -s -o /dev/null -w "%{http_code}" https://<tunnel-host>/manifest?platform=ios&dev=true
curl -s -o /dev/null -w "%{http_code}" "https://<tunnel-host>/node_modules/expo/AppEntry.bundle?platform=ios&dev=true"
```

## Watch a build

```
eas build:view <build-id>
```

Internal distribution installs via the EAS dashboard Install button — no TestFlight / `eas submit`. Don't run `eas submit` on `development`/`preview` internal builds.

## Troubleshooting

- **"Invalid username and password combination"** (Apple auth) → Apple ID + 2FA is blocked from the cloud IP. Use the ASC API Key (`EXPO_ASC_*`). Never attempt Apple ID password auth from a cloud shell.
- **"Failed to set up credentials / non-interactive mode"** (new bundle id) → run `eas credentials:configure-build` via `expect`.
- **Wrong bundle id / dev client overwrites preview** → `EAS_BUILD_PROFILE` wasn't exported; the config fell back to the default bundle id. Confirm it matches the profile passed to `eas build`.
- **2FA code prompt / `eas go`** → only with Apple ID auth, which is blocked from cloud. Use the API key + a real dev client build instead.

## Security

- Never print or commit the `.p8` contents, Apple password, Expo token, or any secret — reference env var names, not values.
- Revocable: ASC key at App Store Connect → Integrations → Team Keys; Expo token at expo.dev → Settings → Access tokens.
- After a session where credentials were shared in chat, advise the user to rotate the Apple ID password and any leaked keys/tokens. Keep the ASC key if builds still run from the cloud.
- Scrub local log/expect files that may have captured credentials after use (`rm -f *.log *.exp /tmp/2fa_code.txt`).
