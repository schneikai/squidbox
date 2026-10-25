# Squidbox

A React Native app for managing photos and videos in the cloud. Like Apple Photos, but files live in the cloud, not on the device — so large photo and video shoots are accessible from your phone without using up its storage. Personal project.

## Monorepo layout

npm workspaces. `npm install` runs once at the repo root.

| Package | What it is |
|---|---|
| `apps/mobile` | Expo React Native app (SDK 55). Run app commands (`scripts/check-env.sh`, `npm run web:preview`) from here; the `.env.local` / `.secrets` files live here too. |
| `apps/server` | Backend: Fastify + TypeScript + Drizzle + Postgres, with AWS S3 for file storage. Runs locally against Docker (Postgres + MinIO), see [Local backend with mock data](#local-backend-with-mock-data). |
| `packages/shared` | Zod wire contracts + sync collection descriptors shared by app and server. |

The backend lives in `apps/server` and runs on **Fly.io** (app `squidbox-server`, region `lhr`) with **Neon Postgres** + **AWS S3** (eu-west-1). API base: `https://squidbox-server.fly.dev/api/v1`.

CI (`.github/workflows/ci.yml`) checks every push and pull request to `main`. Locally: `npm run lint`, `npm run knip`, `npm run typecheck`, and for the tests, with the compose Postgres up and migrated (`npm run compose:up` and `npm run db:migrate` in `apps/server`), `npm run test:db -w apps/server` and `npm run test:e2e -w apps/mobile`. Plain `npm test` skips the DB-backed suites.

## Multi-device sync

The app keeps an on-device SQLite database (expo-sqlite + Drizzle) and syncs with the backend via generic pull/push: per-field last-writer-wins, tombstones for deletes, an outbox for local changes, and a cursor for incremental pulls. Collection descriptors are defined in `packages/shared`.

## Accounts and libraries

Your library lives on the phone; an account backs it up and keeps it in sync. Each library is its own SQLite database plus photo and thumbnail folders, owned either by the device (no account) or by one account on one server:

- **Without an account** the app works on the device library.
- **Signing in** opens that account's library (the one parked from an earlier sign-in, or a new one) and adds whatever the device library holds to it, automatically. The copied photos upload with the next backup.
- **Signing out** only pauses backup and sync: the same library stays open and editable, and what you add uploads when you sign in again. It asks once, only if something isn't backed up yet.
- **Signing in as another account** opens that account's library and parks the current one with its pending changes. Nothing is wiped and nothing mixes.
- **An expired session** (the server rejected the tokens) looks like a sign-out: the avatar shows a badge and Settings says "Backup paused · Sign in to continue" above the pre-filled sign-in form. No alert.

The session is bound to the server's identity (`SERVER_ID`) and to the user, so two servers never share a library. Paths, the session record, the merge and the boot checks are in `docs/sync-design.md` §8; the design history is `docs/library-ownership-plan.md`.

## Launch

`BootScreen` (`apps/mobile/src/features/boot/`) takes over from the native splash with a live copy of it: the vector octopus (`apps/mobile/src/components/octopus/`), which floats, blinks and waves while the app boots, and shows again on the status screens. Its parts are traced from `assets/splash.png` by `apps/mobile/scripts/traceOctopus.py`; rerun it when `splash.png` changes.

## Operational tasks (skills)

Common operations are driven by skills rather than memorized commands:

| Skill | What it does |
|---|---|
| `/deploy-server` | Deploy the backend (Fly.io + Neon). First-time setup and routine one-command deploys; idempotent. |
| `/legacy-import` | Import a user's old app backups (assets/albums/posts JSON in S3) into the backend: canonicalize ids to uuids, map to the current schema, upsert via sync push, verify. |
| `/build` | Build the iOS app from the cloud (no Mac) via EAS. Asks whether to build the **App** (preview/release) or the **Dev Client**, then runs `eas` itself — no flags or profiles to remember. |

The sync engine is described in `docs/sync-design.md`. Open work and ideas are in `todo.md`.

## Environment & secrets

Two gitignored env files in `apps/mobile/`, each for a different audience:

| File | Read by | Purpose |
|---|---|---|
| `.env.local` | Metro, at runtime | Supplies `EXPO_PUBLIC_*` to the **dev client** over the tunnel. Copy from `.env.local.example`, or let `npm run dev:live` / `dev:local` (or `scripts/check-env.sh`) write it from the environment variables. |
| `.secrets` | you, once | Upload bundle to push **preview/release** secrets to EAS. Not read at runtime. |

`.env.local` holds `EXPO_PUBLIC_API_URL`, optional login prefill and Sentry debug. Each variable is explained in `.env.local.example`.

`EXPO_PUBLIC_API_URL` is the deployed backend, `https://squidbox-server.fly.dev/api/v1`. `npm run dev:local` points the dev client at the local backend instead, without touching the file (see [Local backend with mock data](#local-backend-with-mock-data)). Restart `npm run dev:live` or `dev:local` after changing `.env.local`; they start Metro with a cleared cache.

`.secrets` lists the values the **preview/production** builds need (`EXPO_PUBLIC_API_URL`, `SENTRY_AUTH_TOKEN`). They are stored as EAS environment variables:

```
eas env:list --environment preview
eas env:set --name <NAME> --value <value> --visibility secret --environment preview --environment production
```

The `ios-build` skill explains how these get baked into the app and the pitfalls around them.

On a fresh checkout, runtime secrets are already in EAS. Restore the rest from your password manager (`.env.local`, `EXPO_TOKEN`, and the App Store Connect `.p8` + IDs), then run `scripts/check-env.sh` to verify.

## Building the iOS app

Run `/build` — it asks what to build and drives EAS for you (no flags or profiles to type). The two build types install as **separate apps** (different bundle IDs), so both can coexist on the phone:

| | Dev client | Preview / release build |
|---|---|---|
| Profile | `development` | `preview` / `production` |
| Bundle ID | `com.schneikai.squidbox.dev` | `com.schneikai.squidbox` |
| App name | Squidbox (Dev) | Squidbox |
| Icon | dark, with a yellow DEV band (`assets/icon-dev.png`) | the regular icon |
| JS bundle | served by Metro over a tunnel (hot reload); reads `EXPO_PUBLIC_*` from `apps/mobile/.env.local` | baked in at build time from EAS secrets |
| Use for | fast iteration | testing / shipping a stable snapshot |
| Test-build UI (Settings → Assistant → Testing) | yes | `preview` yes, `production` no |

The bundle ID is chosen in `app.config.js` from `EAS_BUILD_PROFILE`, which is why the two don't overwrite each other. The same variable sets `extra.buildProfile` (`development` when unset, as under Metro); `src/utils/isTestBuild.js` shows the test-only UI for `development` and `preview` only. Builds are distributed via [Internal Distribution](https://docs.expo.dev/build/internal-distribution/) (no App Store). Install from the EAS build page (Internal Distribution → Install), then trust the dev certificate in Settings → General → VPN & Device Management.

Cloud builds authenticate to Apple with an **App Store Connect API Key** (`.p8`) — no Mac, no Apple ID password, no 2FA (Apple ID + 2FA is blocked from cloud/datacenter IPs). The full runbook, credential setup, and env vars are in the `ios-build` skill.

### Dev client: Metro + tunnel

The dev client loads JS from Metro at runtime over Expo's tunnel (an `exp.direct` URL, through Expo's own ngrok account; no keys needed, and it works behind the cloud workspace's proxy). One command starts it against the live backend, from the repo root, on a laptop or in the cloud:

```
npm run dev:live
```

It writes a missing `apps/mobile/.env.local` from the environment variables (cloud workspaces), starts Metro with the tunnel (retrying when Expo's tunnel fails, which happens now and then), builds the first bundle so the phone doesn't time out waiting for it, and prints the URL to open in Squidbox (Dev) via "Enter URL manually". Ctrl+C, or SIGTERM to the script, stops Metro and the tunnel. If it can't write one (none of its variables are set), it stops before starting Metro, which would otherwise serve a bundle with no `EXPO_PUBLIC_*` values; `scripts/check-env.sh` in `apps/mobile/` shows what's missing.

The Expo tunnel URL stays the same across restarts of the same checkout. Metro starts with a cleared cache, so changes to `.env.local` or packages take effect on the next start.

### Local backend with mock data

The dev client can run against a local backend filled with stock photos, albums and posts, so testing never touches your real library. One command starts everything, from the repo root (needs Docker and `.env.local`):

```
npm run dev:local                    # start
npm run dev:local -- --reset-data    # start and reset the account to exactly the mock data set
```

It starts Postgres + MinIO, applies migrations and creates the local accounts, starts Metro with Expo's tunnel, then the API server, and prints the tunnel URL to open in Squidbox (Dev). The login form is prefilled with the local account, unless `.env.local` sets its own prefill. Ctrl+C, or SIGTERM to the script, stops Metro, the tunnel and the API server, also when a step fails; the Docker stack keeps running.

Metro serves the API and file storage through its own tunnel (`apps/mobile/scripts/localBackendProxy.js`), and the script sets `EXPO_PUBLIC_LOCAL_BACKEND`, which makes the app send its API calls to the dev server it loaded from (`Constants.expoConfig.hostUri`). So no env file holds the tunnel URL, and `.env.local` stays pointed at the live backend. On the first run, `apps/server/.env` is created from `.env.docker`.

To go back to your real library, run `npm run dev:live` and sign in with your account: the local account's library is parked and yours opens (see [Accounts and libraries](#accounts-and-libraries)). The local backend has its own `SERVER_ID` (`apps/server/.env.docker`), so its session and library never pass for the live server's; a new dev tunnel host (another checkout) costs no sign-in, since the app re-checks the server's identity on `/up` first.

If Docker pulls fail, or the server can't reach MinIO, see `apps/server/README.md` → "Local development".

### Web preview

There is no iOS Simulator outside macOS, so UI changes can also be checked in the app's web build, at iPhone 15 Pro Max size, against the local backend. With `npm run dev:local` running, from `apps/mobile/`:

```
npm run web:preview -- shot.png      # signs in, opens the library, saves a screenshot, prints console errors
```

Scripts can drive it through `openWebPreview()` and `settleAsync()` in `scripts/webPreview.mjs` (Playwright): tap, type, navigate and take screenshots. Outside the cloud workspace, run `npx playwright install chromium` once.

`npm run dev:local -- --web` starts everything without Expo's tunnel, which is all the web preview needs and keeps it working when the tunnel is down. Add `--production` to `web:preview` to load Metro's release bundle, without React's development overhead, for performance checks; `npm run web:measure` times reload → first grid cell, the idle JS heap and a favorite toggle on it. For a large library, `npm run seed:mock -- --assets 50000` in `apps/server/` pads the mock account (the extra assets reuse the mock photos' and videos' files).

The web build is a preview, not a target. Platform files (`*.web.js`) stand in for what the browser lacks: the session record and the library list live in `localStorage` (the preview script seeds the session once per browser context, with the page's origin as `apiBaseUrl`), and thumbnails load straight from their signed URLs. The camera roll, uploads, file downloads and native gestures don't work there, so confirm those on a device. The database works the same as on iOS: the app only uses expo-sqlite's async API (`docs/sync-design.md` §8). Web storage holds a fixed number of database files, so besides the open library about three parked ones (other accounts signed in to in the same browser context) fit; a fourth fails to open and the sign-in shows the error, with the previous library still open. A preview run is a fresh context, so this never builds up.

## Deploying the backend

Run `/deploy-server`. It handles first-time setup (Fly app + Neon DB + secrets + seed) and routine deploys (build, migrate, release) via the `fly` and `neonctl` CLIs. To import a user's old backups, run `/legacy-import`.

## Dependencies

If `expo-doctor` flags version drift, do NOT run `expo install --fix` (or any `npm install`) from `apps/mobile/`. In this npm-workspaces monorepo that bumps only the app and leaves old versions hoisted at the workspace root, which gives duplicate native modules that won't dedupe. Instead, set the target versions in `apps/mobile/package.json`, then do ONE clean install from the repo root (`rm -rf node_modules apps/*/node_modules packages/*/node_modules package-lock.json && npm install`), then rebuild the dev client.

`@sentry/react-native` is pinned to **8.x** on purpose (see `expo.install.exclude` in `apps/mobile/package.json`): 8.x supports React 19 and the New Architecture that SDK 55 needs, while expo-doctor still suggests ~7.11, which breaks the build.

## Sentry

Sentry handles error tracking. Configure it for your own account:

- `app.config.js`: specify organization and project in the Sentry Plugin section
- `SENTRY_AUTH_TOKEN`: a secret stored in EAS (see [Environment & secrets](#environment--secrets))
- `App.js`: set the DSN in the `Sentry.init` call

## Caveats

- **Signing expires yearly.** The distribution certificate and the ad hoc provisioning profiles of both apps are valid until **Oct 10, 2027**. An installed app stops opening when its profile expires. The `ios-build` skill covers renewing them.
- **Build downloads expire after 14 days.** EAS deletes internal build artifacts after about two weeks. `eas build:resign` only works within that window, after that you need a new build.
- Build/preview help: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/build/internal-distribution/
