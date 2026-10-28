# Squidbox

A React Native app for managing photos and videos in the cloud. Like Apple Photos, but files live in the cloud, not on the device — so large photo and video shoots are accessible from your phone without using up its storage. Personal project.

## Monorepo layout

npm workspaces. `npm install` runs once at the repo root.

| Package | What it is |
|---|---|
| `apps/mobile` | Expo React Native app (SDK 55). Run app commands (`scripts/check-env.sh`, `npm run web:preview`) from here; the `.env.local` / `.secrets` files live here too. |
| `apps/server` | Backend: Fastify + TypeScript + Drizzle + Postgres, with AWS S3 for file storage. Runs locally against Docker (Postgres + MinIO), see [Dev client](#dev-client). |
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
| `/ios-build` | Build the iOS app from the cloud (no Mac) via EAS. Asks whether to build the **App** (preview/release) or the **Dev Client**, then runs `eas` itself — no flags or profiles to remember. |
| `/build` | Deliver a feature, bug fix or refactor end to end: plan, build, review and a PR. |

The sync engine is described in `docs/sync-design.md`. Open work and ideas are in `todo.md`.

## Environment & secrets

Two gitignored env files in `apps/mobile/`, each for a different audience:

| File | Read by | Purpose |
|---|---|---|
| `.env.local` | Metro, at runtime | Supplies `EXPO_PUBLIC_*` to the **dev client** over the tunnel. Copy from `.env.local.example`, or let `npm run dev:local` (or `scripts/check-env.sh`) write it from the environment variables. |
| `.secrets` | you, once | Upload bundle to push **preview/release** secrets to EAS. Not read at runtime. |

`.env.local` holds `EXPO_PUBLIC_API_URL`, optional login prefill and Sentry debug. Each variable is explained in `.env.local.example`.

`EXPO_PUBLIC_API_URL` is the deployed backend, `https://squidbox-server.fly.dev/api/v1`. `npm run dev:local` points the dev client at the local backend instead, without touching the file (see [Dev client](#dev-client)). Restart `npm run dev:local` after changing `.env.local`; it starts Metro with a cleared cache.

`.secrets` lists the values the **preview/production** builds need (`EXPO_PUBLIC_API_URL`, `SENTRY_AUTH_TOKEN`). They are stored as EAS environment variables; the `ios-build` skill has the commands, how they get baked into the app and the pitfalls around them.

On a fresh checkout, runtime secrets are already in EAS. Restore the rest from your password manager (`.env.local`, `EXPO_TOKEN`, and the App Store Connect `.p8` + IDs), then run `scripts/check-env.sh` to verify.

## Building the iOS app

Run `/ios-build`: it asks what to build and drives EAS for you (no flags or profiles to type). The two build types install as **separate apps** (different bundle IDs), so both can coexist on the phone:

| | Dev client | Preview / release build |
|---|---|---|
| Profile | `development` | `preview` / `production` |
| Bundle ID | `com.schneikai.squidbox.dev` | `com.schneikai.squidbox` |
| App name | Squidbox (Dev) | Squidbox |
| Icon | dark, with a yellow DEV band (`assets/icon-dev.png`) | the regular icon |
| JS bundle | served by Metro over a tunnel (hot reload); reads `EXPO_PUBLIC_*` from `apps/mobile/.env.local` | baked in at build time from EAS secrets |
| Use for | fast iteration | testing / shipping a stable snapshot |
| Test-build UI (Settings → Assistant → Testing) | yes | `preview` yes, `production` no |

The bundle ID is chosen in `app.config.js` from `EAS_BUILD_PROFILE`, which is why the two don't overwrite each other. The same variable sets `extra.buildProfile` (unset for a build made without EAS); `src/utils/isTestBuild.js` shows the test-only UI under Metro (a development bundle) and in the `development` and `preview` builds only. Builds are distributed via [Internal Distribution](https://docs.expo.dev/build/internal-distribution/) (no App Store). Installing, credentials (an App Store Connect API key, no Mac), signing renewal and the full runbook are in the `ios-build` skill.

### Dev client

The dev client loads JS from Metro at runtime over Expo's tunnel (an `exp.direct` URL, through Expo's own ngrok account; no keys needed, and it works behind the cloud workspace's proxy). It always runs against a local backend filled with stock photos, albums and posts, so testing never touches your real library. One command starts everything, from the repo root, on a laptop or in the cloud (needs Docker):

```
npm run dev:local                    # start
npm run dev:local -- --reset-data    # start and reset the account to exactly the mock data set
```

It writes a missing `apps/mobile/.env.local` from the environment variables (cloud workspaces; with none set it stops, and `scripts/check-env.sh` in `apps/mobile/` shows what's missing), starts Postgres + MinIO, applies migrations and creates the local accounts, starts Metro with the tunnel (retrying when Expo's tunnel fails, which happens now and then), then the API server, builds the first bundle so the phone doesn't time out, and prints the URL to open in Squidbox (Dev) via "Enter URL manually". The login form is prefilled with the local account, unless `.env.local` sets its own prefill. Ctrl+C, or SIGTERM to the script, stops Metro, the tunnel and the API server, also when a step fails; the Docker stack keeps running. The tunnel URL stays the same across restarts of the same checkout, and Metro starts with a cleared cache, so changes to `.env.local` or packages take effect on the next start.

Metro serves the API and file storage through its own tunnel (`apps/mobile/scripts/localBackendProxy.js`), and the script sets `EXPO_PUBLIC_LOCAL_BACKEND`, which makes the app send its API calls to the dev server it loaded from (`Constants.expoConfig.hostUri`). So no env file holds the tunnel URL, and `.env.local` stays pointed at the live backend. On the first run, `apps/server/.env` is created from `.env.docker`. The local backend has its own `SERVER_ID`, so its session and library never pass for the live server's.

**The live backend, on the owner's request only.** To look into a problem in your own account, `npm run dev:local -- --live-backend-on-owner-request` starts Metro and the tunnel against `EXPO_PUBLIC_API_URL` instead. Sign in with your account: the local account's library is parked and yours opens (see [Accounts and libraries](#accounts-and-libraries)). Never use it otherwise: the dev client's changes go to your real library.

If Docker pulls fail, or the server can't reach MinIO, see `apps/server/README.md` → "Local development".

### Web preview

There is no iOS Simulator outside macOS, so UI changes can also be checked in the app's web build, at iPhone 15 Pro Max size, against the local backend. With `npm run dev:local` running, from `apps/mobile/`:

```
npm run web:preview -- shot.png      # signs in, opens the library, saves a screenshot, prints console errors
```

Scripts can drive it through `openWebPreview()` and `settleAsync()` in `scripts/webPreview.mjs` (Playwright): tap, type, navigate and take screenshots. Outside the cloud workspace, run `npx playwright install chromium` once.

`npm run dev:local -- --web` starts everything without Expo's tunnel, which is all the web preview needs and keeps it working when the tunnel is down. Add `--production` to `web:preview` to load Metro's release bundle, without React's development overhead, for performance checks; `npm run web:measure` times reload → first grid cell, the idle JS heap and a favorite toggle on it. For a large library, `npm run seed:mock -- --assets 50000` in `apps/server/` pads the mock account (the extra assets reuse the mock photos' and videos' files).

The web build is a preview, not a target. Platform files (`*.web.js`) stand in for what the browser lacks: the session record and the library list live in `localStorage` (the preview script seeds the session once per browser context, with the page's origin as `apiBaseUrl`), and thumbnails load straight from their signed URLs. The camera roll, uploads, file downloads and native gestures don't work there, so confirm those on a device. The database works the same as on iOS: the app only uses expo-sqlite's async API (`docs/sync-design.md` §8). Web storage holds a fixed number of database files, so besides the open library about three parked ones (other accounts signed in to in the same browser context) fit; a fourth fails to open and the sign-in shows the error, with the previous library still open. A preview run is a fresh context, so this never builds up.

## Checking a chat model

Before offering a Venice model as the assistant's writing model, run the chat check on it from `apps/server/`: `npm run check:chat-models -- deepseek-v4-1-flash-uncensored kimi-k3` (`--scenario <id>` for one scenario, `--out <file.md>` for the report's path). It runs fixed conversations through the server's own chat code and default briefing, as the mock account's creator, against Venice directly with `VENICE_API_KEY` (no database, no backend). It checks what it can by itself: talk before posts, the counts asked for, shorter when asked, bios in the text, "this" meaning the caption, the persona's rules, no copied Favorites, exact handles, asking instead of inventing. Every transcript goes to a Markdown report in `apps/server/.model-checks/` (gitignored), with pass counts and seconds per turn, so read the replies too.

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

- **Signing expires yearly** (next: **Oct 10, 2027**), and an installed app stops opening when its profile does. **Build downloads expire after about 14 days.** The `ios-build` skill covers both.
- Build/preview help: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/build/internal-distribution/
