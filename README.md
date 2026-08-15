# Squidbox

A React Native app for managing photos and videos in the cloud. Like Apple Photos, but files live in the cloud, not on the device — so large photo and video shoots are accessible from your phone without using up its storage. Personal project, backed by a Rails API.

# Prerequisites

Builds and previews run from a cloud workspace (no Mac) using EAS Build and an App Store Connect API Key. You need:

- An Expo account + EAS project (`eas.json`, `app.config.js`).
- An **App Store Connect API Key** (`.p8`) — see [Building from the cloud](#building-from-the-cloud-no-mac).
- App secrets stored in EAS (see below).

# Environment & secrets

Two gitignored env files, each for a different audience:

| File | Read by | Purpose |
|---|---|---|
| `.env.local` | Metro, at runtime | Supplies `EXPO_PUBLIC_*` to the **dev client** over the tunnel. Copy from `.env.local.example`. The API URL must be reachable from the phone (not `localhost`). |
| `.secrets` | you, once | Upload bundle to push **preview/production** secrets to EAS. Not read at runtime. |

`.env.local` (template in `.env.local.example`):

```
EXPO_PUBLIC_API_URL=<reachable-api-url>/api/v1
EXPO_PUBLIC_LOGIN_FORM_EMAIL=user@example.com
EXPO_PUBLIC_LOGIN_FORM_PASSWORD=password
EXPO_PUBLIC_SENTRY_DEBUG=true
EXPO_PUBLIC_OPENAI_API_KEY=<openai-key>
```

`.secrets` (push to EAS):

```
EXPO_PUBLIC_API_URL=<production-api-url>
SENTRY_AUTH_TOKEN=<sentry-token>
```

Manage EAS secrets:

```
eas secret:push --scope project --env-file .secrets   # add (--force to update)
eas secret:list                                       # list
```

On a fresh checkout, runtime secrets are already in EAS. Restore the rest from your password manager: `.env.local`, `EXPO_TOKEN`, and the ASC `.p8`+IDs, then run `scripts/check-env.sh` to verify.

# Build & preview

Two ways to get the app on a device — they install as **separate apps** (different bundle IDs), so both can coexist on the phone:

| | Dev client | Preview build |
|---|---|---|
| Profile | `development` | `preview` |
| Bundle ID | `com.schneikai.squidbox.dev` | `com.schneikai.squidbox` |
| App name | Squidbox (Dev) | Squidbox |
| JS bundle | served by Metro over a tunnel (hot reload) | baked in at build time |
| Use for | fast iteration | testing a stable snapshot |

The bundle ID is chosen in `app.config.js` from `EAS_BUILD_PROFILE`, which is why the two don't overwrite each other. Builds are distributed via [Internal Distribution](https://docs.expo.dev/build/internal-distribution/) (no App Store).

## Building from the cloud (no Mac)

From a cloud workspace, authenticate Apple with an **App Store Connect API Key** — no Mac, no Apple ID password, no 2FA (Apple ID + 2FA is blocked from cloud/datacenter IPs; the API key is Apple's CI-native path).

**One-time setup:**

1. Generate an App Store Connect API Key (**Admin** role) at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Users and Access → Integrations → Team Keys. Download the `.p8` (downloadable **once**) and note the **Key ID** and **Issuer ID**.
2. Get your **Apple Team ID** from [developer.apple.com](https://developer.apple.com) → Membership.
3. The `.p8` is gitignored (`*.p8`) — never commit it.

**Env vars (set before each build):**

```
EXPO_TOKEN=<expo access token>
EAS_BUILD_PROFILE=<development | preview>
EXPO_ASC_API_KEY_PATH=<path to .p8>
EXPO_ASC_KEY_ID=<key id>
EXPO_ASC_ISSUER_ID=<issuer id>
EXPO_APPLE_TEAM_ID=<team id>
EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
CI=1
```

The CLI authenticates to Expo via `EXPO_TOKEN` (no `eas login`). Routine builds reuse stored credentials; the `.p8` is only needed for one-time credential setup on a new bundle ID.

**Preview build** (secrets already in EAS):

```
eas build --profile preview --platform ios --non-interactive
```

**Dev client build:**

```
eas credentials:configure-build -p ios -e development   # first time only; TTY prompts need expect
eas build --profile development --platform ios --non-interactive
```

Install from the EAS build page (Internal Distribution → Install), then trust the dev certificate in Settings → General → VPN & Device Management.

## Dev client: Metro + tunnel

The dev client loads JS from Metro at runtime. Start Metro and the tunnel, then point the dev client at the tunnel URL:

```
EXPO_PACKAGER_PROXY_URL=https://<tunnel-host> npx expo start --offline
node tunnel.js
```

Add `-c` to `expo start` to clear the cache (after changing `.env.local` or upgrading packages). Verify the tunnel before connecting: `curl -o /dev/null -w "%{http_code}" https://<tunnel-host>/manifest?platform=ios&dev=true`.

> The full headless runbook (exact commands, the `expect`-driven credential setup, troubleshooting) is in the `cloud-ios-build` skill.

## One-time EAS setup

Run `eas build:configure` to generate `eas.json`, then register a device for Internal Distribution with `eas device:create` (manage devices at https://docs.expo.dev/build/internal-distribution/#managing-devices).

## Legacy workflow (historical)

Builds used to run on a Mac with the Rails API on `localhost:3000` and the phone on the same wifi (or Expo Go). That path is gone, but remnants may still turn up: a `.env.local` pointing at `localhost`, references to `eas login`/Expo Go/`rails server -b 0.0.0.0`, or a static `app.json` (now `app.config.js`). They're leftovers, not the current process.

# Sentry

Sentry handles error tracking. Configure it for your own account:

- `app.config.js`: specify organization and project in the Sentry Plugin section
- `SENTRY_AUTH_TOKEN`: a secret stored in EAS (see [Environment & secrets](#environment--secrets))
- `App.js`: set the DSN in the `Sentry.init` call

# Ideas

- Try the native Expo Router (introduced in Expo 50) and maybe drop the `react-navigation-native` dependency.
- SQLite for local data storage: native in Expo 50+ https://docs.expo.dev/versions/v50.0.0/sdk/sqlite-next/ · guide https://blog.stackademic.com/offline-react-native-app-with-typeorm-expo-sqlite-and-react-query-37e5b8a05abb

# Caveats

- Preview builds are signed with a certificate that expires after a year, so rebuild when it lapses. Build/preview help: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/build/internal-distribution/
