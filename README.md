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

CI (`.github/workflows/ci.yml`) checks every push and pull request to `main`. Locally: `npm run check` while working (what changed since main, failures only), `npm run check:all` before a PR (lint, format, typecheck, knip and the plain tests over the whole repo), and for the DB tests, with the compose Postgres up and migrated (`npm run compose:up` and `npm run db:migrate` in `apps/server`), `npm run test:db -w apps/server` and `npm run test:e2e -w apps/mobile`. Plain `npm test` skips the DB-backed suites, and the seeded fuzz tests run a tenth of their cases; `FUZZ_DEEP=1` runs them all, as CI does.

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
| `/deploy-server` | Deploy the backend (Fly.io + Neon): build, migrate, release. |
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

`EXPO_PUBLIC_API_URL` is the deployed backend, `https://squidbox-server.fly.dev/api/v1`. `npm run dev:local` points the dev client at the local backend instead, without touching the file (see [Dev client](#dev-client)). Restart `npm run dev:local` after changing `.env.local`; it then rebuilds the bundle from scratch.

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
npm run dev:local -- --clear         # start with Metro's cache cleared (see "Metro's cache" below)
```

It writes a missing `apps/mobile/.env.local` from the environment variables (cloud workspaces; with none set it stops, and `scripts/check-env.sh` in `apps/mobile/` shows what's missing), starts Postgres + MinIO, applies migrations and creates the local accounts, starts Metro with the tunnel (retrying when Expo's tunnel fails, which happens now and then), then the API server, builds the first bundle so the phone doesn't time out, and prints the URL to open in Squidbox (Dev) via "Enter URL manually". The login form is prefilled with the local account, unless `.env.local` sets its own prefill. Ctrl+C, or SIGTERM to the script, stops Metro, the tunnel and the API server, also when a step fails; the Docker stack keeps running. The tunnel URL stays the same across restarts of the same checkout.

Metro serves the API and file storage through its own tunnel (`apps/mobile/scripts/localBackendProxy.js`), and the script sets `EXPO_PUBLIC_LOCAL_BACKEND`, which makes the app send its API calls to the dev server it loaded from (`Constants.expoConfig.hostUri`). So no env file holds the tunnel URL, and `.env.local` stays pointed at the live backend. On the first run, `apps/server/.env` is created from `.env.docker`. The local backend has its own `SERVER_ID`, so its session and library never pass for the live server's.

**A copy of your own library.** To judge features like the AI on your real posts and photos, Settings → Dev accounts switches between the mock library and a copy of your live library with one tap. The first time you open the copy, the local server copies your library's data from the live database (one read-only transaction; `npm run dev:local` gets the database URL from the live server through `fly`, or from `LIVE_DATABASE_URL`). Files are never copied: the copy shows your photos from the live bucket through read-only links, signed with the live server's AWS keys (read from it through `fly` with the database URL, kept in the API server's memory only; `LIVE_AWS_ACCESS_KEY_ID` / `LIVE_AWS_SECRET_ACCESS_KEY` override them). Uploads to the copy are refused, and its deletes reach only the local storage, so nothing in the copy reaches your live library (`apps/server/src/dev/libraryCopy.ts`).

**The live backend, on the owner's request only.** To look into a problem in your own account, `npm run dev:local -- --live-backend-on-owner-request` starts Metro and the tunnel against `EXPO_PUBLIC_API_URL` instead. Sign in with your account: the local account's library is parked and yours opens (see [Accounts and libraries](#accounts-and-libraries)). Never use it otherwise: the dev client's changes go to your real library.

**Metro's cache.** Metro keeps its cache across restarts, so a restart rebuilds only the files that changed (seconds, not the half minute of a full build). The script clears it on its own when something baked into the cached files changed since the last start: an `EXPO_PUBLIC_*` value (`.env.local`, or the local and live backends' own), `package-lock.json`, `babel.config.js` or `metro.config.js`. A stale cache that slips past that shows as the app running old code or an old setting after a restart: a fix that doesn't show up, the wrong backend or login prefill, or an error naming a module that's gone or was renamed. Then restart with `npm run dev:local -- --clear`.

**Keeping it up in a cloud session.** A cloud session's machine shuts down a few minutes after the agent goes quiet, which stops the dev client and Docker. So an agent that starts `npm run dev:local` in the background also starts a tracked background task (Bash with `run_in_background`, the longest timeout) that only waits on it, such as `while pgrep -f "node scripts/dev.mjs" >/dev/null; do sleep 30; done`, and starts it again when it ends. That keeps the machine awake while the owner tests. After a shutdown, start Docker again (`dockerd`), then `npm run dev:local`.

If Docker pulls fail, or the server can't reach MinIO, see `apps/server/README.md` → "Local development".

### Web preview

There is no iOS Simulator outside macOS, so UI changes can also be checked in the app's web build, at iPhone 15 Pro Max size, against the local backend. With `npm run dev:local` running, from `apps/mobile/`:

```
npm run web:preview -- shot.png      # signs in, opens the library, saves a screenshot, prints console errors
```

Scripts can drive it through `openWebPreview()` and `settleAsync()` in `scripts/webPreview.mjs` (Playwright): tap, type, navigate and take screenshots. Outside the cloud workspace, run `npx playwright install chromium` once.

`npm run dev:local -- --web` starts everything without Expo's tunnel, which is all the web preview needs and keeps it working when the tunnel is down. Add `--production` to `web:preview` to load Metro's release bundle, without React's development overhead, for performance checks; `npm run web:measure` times reload → first grid cell, the idle JS heap and a favorite toggle on it. For a large library, `npm run seed:mock -- --assets 50000` in `apps/server/` pads the mock account (the extra assets reuse the mock photos' and videos' files).

The web build is a preview, not a target. Platform files (`*.web.js`) stand in for what the browser lacks: the session record and the library list live in `localStorage` (the preview script seeds the session once per browser context, with the page's origin as `apiBaseUrl`), and thumbnails load straight from their signed URLs. The camera roll, uploads, file downloads and native gestures don't work there, so confirm those on a device. The database works the same as on iOS: the app only uses expo-sqlite's async API (`docs/sync-design.md` §8). Web storage holds a fixed number of database files, so besides the open library about three parked ones (other accounts signed in to in the same browser context) fit; a fourth fails to open and the sign-in shows the error, with the previous library still open. A preview run is a fresh context, so this never builds up.

## Verifying a model

Before offering a Venice model as one of the assistant's models, verify it. An ai_admin account verifies from the app: Settings → Assistant → Writing or Vision → a model → Verify, reads every conversation on the Verify page, and sets the model's labels (Verified, Uncensored, Default, Uncensored default) on the model's page. Default and Uncensored default are the admin's own picks until Apply changes for everyone at the end of the model list gives them to every account. The same Verify runs from `apps/server/` with `npm run verify:models -- deepseek-v4-1-flash-uncensored kimi-k3` (`--kind vision` for the vision Verify, `--scenario <id>` for one writing conversation, `--out <file.md>` for the report's path), against Venice directly with `VENICE_API_KEY` (no database, no backend, the built-in instructions).

- **Writing**: fixed conversations run through the server's own chat code and briefing, as the mock account's creator. It checks what code can: talk before posts, the counts asked for, shorter when asked, bios in the text, "this" meaning the caption, the persona's rules, no copied Favorites, exact handles, asking instead of inventing. Then the judge (`VERIFY_JUDGE_MODEL_ID` in `packages/shared/contracts/ai.ts`) judges each turn: did the reply answer the request and hold the conversation (its prompt is the Verify judge in Instructions).
- **Vision**: four fixed photos (`apps/server/src/ai/verifyPhotos/`) tagged with the Photo tags briefing; it checks only that valid tags come back (JSON, within the limits, no refusal). What they say is judged in Compare.

A wrong, refused or too slow answer (or any other error about the call) is the model's miss and the run goes on; Venice not answering (unreachable, busy or failing: 429, 5xx) stops the run, with the turns before kept. The CLI writes every turn to a Markdown report in `apps/server/.model-verify/` (gitignored), with pass counts and seconds per turn, so read the replies too.

## Deploying the backend

Run `/deploy-server`. It builds, migrates and releases via the `fly` CLI.

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
