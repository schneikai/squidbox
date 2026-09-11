# Squidbox

A React Native app for managing photos and videos in the cloud. Like Apple Photos, but files live in the cloud, not on the device — so large photo and video shoots are accessible from your phone without using up its storage. Personal project.

## Monorepo layout

npm workspaces. `npm install` runs once at the repo root.

| Package | What it is |
|---|---|
| `apps/mobile` | Expo React Native app (SDK 55). Run app commands (`npx expo start`, `node tunnel.js`, `scripts/check-env.sh`) from here; the `.env.local` / `.secrets` files live here too. |
| `apps/server` | Backend: Fastify + TypeScript + Drizzle + Postgres, with AWS S3 for file storage. |
| `packages/shared` | Zod wire contracts + sync collection descriptors shared by app and server. |

The backend was migrated from Rails to TypeScript; that migration is complete and deployed. The server lives in `apps/server` and is deployed on **Fly.io** (app `squidbox-server`, region `lhr`) with **Neon Postgres** + **AWS S3** (eu-west-1). API base: `https://squidbox-server.fly.dev/api/v1`.

## Multi-device sync

The app keeps an on-device SQLite database (expo-sqlite + Drizzle) and syncs with the backend via generic pull/push: whole-record last-writer-wins, tombstones for deletes, an outbox for local changes, and a cursor for incremental pulls. Collection descriptors are defined in `packages/shared`.

## Operational tasks (skills)

Common operations are driven by skills rather than memorized commands:

| Skill | What it does |
|---|---|
| `/deploy-server` | Deploy the backend (Fly.io + Neon). First-time setup and routine one-command deploys; idempotent. |
| `/legacy-import` | One-time import of the old Rails S3 JSON library (assets/albums/posts) into the backend — download, canonicalize ids to uuids, map to the modern schema, upsert via sync push, verify. |
| `/cloud-ios-build` | Build the iOS app from the cloud (no Mac) via EAS. Asks whether to build the **App** (preview/release) or the **Dev Client**, then runs `eas` itself — no flags or profiles to remember. |

Status and next steps for the migration are tracked in `docs/migration/STATUS.md`.

## Environment & secrets

Two gitignored env files in `apps/mobile/`, each for a different audience:

| File | Read by | Purpose |
|---|---|---|
| `.env.local` | Metro, at runtime | Supplies `EXPO_PUBLIC_*` to the **dev client** over the tunnel. Copy from `.env.local.example`. |
| `.secrets` | you, once | Upload bundle to push **preview/release** secrets to EAS. Not read at runtime. |

`.env.local` (template in `.env.local.example`):

```
EXPO_PUBLIC_API_URL=https://squidbox-server.fly.dev/api/v1
EXPO_PUBLIC_LOGIN_FORM_EMAIL=user@example.com
EXPO_PUBLIC_LOGIN_FORM_PASSWORD=password
EXPO_PUBLIC_SENTRY_DEBUG=true
EXPO_PUBLIC_OPENAI_API_KEY=<openai-key>
```

`EXPO_PUBLIC_API_URL` must be reachable **from the phone** (not `localhost`). The deployed backend at `https://squidbox-server.fly.dev/api/v1` satisfies this.

`.secrets` (push to EAS):

```
EXPO_PUBLIC_API_URL=<api-url>
SENTRY_AUTH_TOKEN=<sentry-token>
```

Manage EAS secrets:

```
eas secret:push --scope project --env-file .secrets   # add (--force to update)
eas secret:list                                       # list
```

On a fresh checkout, runtime secrets are already in EAS. Restore the rest from your password manager (`.env.local`, `EXPO_TOKEN`, and the App Store Connect `.p8` + IDs), then run `scripts/check-env.sh` to verify.

## Building the iOS app

Run `/cloud-ios-build` — it asks what to build and drives EAS for you (no flags or profiles to type). The two build types install as **separate apps** (different bundle IDs), so both can coexist on the phone:

| | Dev client | Preview / release build |
|---|---|---|
| Profile | `development` | `preview` / `production` |
| Bundle ID | `com.schneikai.squidbox.dev` | `com.schneikai.squidbox` |
| App name | Squidbox (Dev) | Squidbox |
| JS bundle | served by Metro over a tunnel (hot reload); reads `EXPO_PUBLIC_*` from `apps/mobile/.env.local` | baked in at build time from EAS secrets |
| Use for | fast iteration | testing / shipping a stable snapshot |

The bundle ID is chosen in `app.config.js` from `EAS_BUILD_PROFILE`, which is why the two don't overwrite each other. Builds are distributed via [Internal Distribution](https://docs.expo.dev/build/internal-distribution/) (no App Store). Install from the EAS build page (Internal Distribution → Install), then trust the dev certificate in Settings → General → VPN & Device Management.

Cloud builds authenticate to Apple with an **App Store Connect API Key** (`.p8`) — no Mac, no Apple ID password, no 2FA (Apple ID + 2FA is blocked from cloud/datacenter IPs). The full runbook, credential setup, and env vars are in the `cloud-ios-build` skill.

### Dev client: Metro + tunnel

The dev client loads JS from Metro at runtime over an ngrok tunnel. `/cloud-ios-build` sets this up, but the low-level commands are:

```
EXPO_PACKAGER_PROXY_URL=https://<tunnel-host> npx expo start --offline
NGROK_AUTHTOKEN=<token> node tunnel.js
```

The tunnel uses a random subdomain (e.g. `https://abc-123.ngrok-free.dev`), so each session gets its own URL. `NGROK_AUTHTOKEN` is read from `.env.local`.

> **ERR_NGROK_334?** The ngrok free plan reuses one reserved domain. If a previous session didn't shut down cleanly, ngrok blocks with `ERR_NGROK_334`. `tunnel.js` retries automatically; for a guaranteed fix, add `NGROK_API_KEY` (dashboard → API Keys) to `.env.local` so `tunnel.js` can force-kill stale endpoints before starting.

Add `-c` to `expo start` to clear the cache (after changing `.env.local` or upgrading packages).

## Deploying the backend

Run `/deploy-server`. It handles first-time setup (Fly app + Neon DB + secrets + seed) and routine deploys (build, migrate, release) via the `fly` and `neonctl` CLIs. To seed the backend with the old library, run `/legacy-import` (a separate one-time step).

## Sentry

Sentry handles error tracking. Configure it for your own account:

- `app.config.js`: specify organization and project in the Sentry Plugin section
- `SENTRY_AUTH_TOKEN`: a secret stored in EAS (see [Environment & secrets](#environment--secrets))
- `App.js`: set the DSN in the `Sentry.init` call

## Caveats

- Preview builds are signed with a certificate that expires after a year, so rebuild when it lapses. Build/preview help: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/build/internal-distribution/
