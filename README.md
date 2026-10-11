# Squidbox

A React Native app for managing photos and videos in the cloud. Like Apple Photos, but files live in the cloud, not on the device — so large photo and video shoots are accessible from your phone without using up its storage. Personal project.

## Monorepo layout

npm workspaces. `npm install` runs once at the repo root.

| Package | What it is |
|---|---|
| `apps/mobile` | Expo React Native app (SDK 55). Run app commands (`npx expo start`, `node tunnel.js`, `scripts/check-env.sh`) from here; the `.env.local` / `.secrets` files live here too. |
| `apps/server` | Backend: Fastify + TypeScript + Drizzle + Postgres, with AWS S3 for file storage. Runs locally against Docker (Postgres + MinIO), see [Local backend with mock data](#local-backend-with-mock-data). |
| `packages/shared` | Zod wire contracts + sync collection descriptors shared by app and server. |

The backend lives in `apps/server` and runs on **Fly.io** (app `squidbox-server`, region `lhr`) with **Neon Postgres** + **AWS S3** (eu-west-1). API base: `https://squidbox-server.fly.dev/api/v1`.

## Multi-device sync

The app keeps an on-device SQLite database (expo-sqlite + Drizzle) and syncs with the backend via generic pull/push: whole-record last-writer-wins, tombstones for deletes, an outbox for local changes, and a cursor for incremental pulls. Collection descriptors are defined in `packages/shared`.

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
| `.env.local` | Metro, at runtime | Supplies `EXPO_PUBLIC_*` to the **dev client** over the tunnel. Copy from `.env.local.example`. |
| `.secrets` | you, once | Upload bundle to push **preview/release** secrets to EAS. Not read at runtime. |

`.env.local` holds `EXPO_PUBLIC_API_URL`, `NGROK_AUTHTOKEN`, optional login prefill, Sentry debug, the OpenAI key, and optionally `LOCAL_BACKEND_URL`. Each variable is explained in `.env.local.example`.

`EXPO_PUBLIC_API_URL` must be reachable **from the phone** (not `localhost`). Use either the deployed backend at `https://squidbox-server.fly.dev/api/v1`, or the local backend through Metro's tunnel (see [Local backend with mock data](#local-backend-with-mock-data)). Restart Metro with `-c` after changing it.

`.secrets` lists the values the **preview/production** builds need (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_OPENAI_API_KEY`, `SENTRY_AUTH_TOKEN`). They are stored as EAS environment variables:

```
eas env:list --environment preview
eas env:set --name <NAME> --value <value> --visibility secret --environment preview --environment production
```

The `build` skill explains how these get baked into the app and the pitfalls around them.

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

The bundle ID is chosen in `app.config.js` from `EAS_BUILD_PROFILE`, which is why the two don't overwrite each other. Builds are distributed via [Internal Distribution](https://docs.expo.dev/build/internal-distribution/) (no App Store). Install from the EAS build page (Internal Distribution → Install), then trust the dev certificate in Settings → General → VPN & Device Management.

Cloud builds authenticate to Apple with an **App Store Connect API Key** (`.p8`) — no Mac, no Apple ID password, no 2FA (Apple ID + 2FA is blocked from cloud/datacenter IPs). The full runbook, credential setup, and env vars are in the `build` skill.

### Dev client: Metro + tunnel

The dev client loads JS from Metro at runtime over a tunnel. Run `scripts/check-env.sh` first: without `.env.local`, Metro serves a bundle with no `EXPO_PUBLIC_*` values. There are two ways to open the tunnel, both from `apps/mobile/`.

**Your own ngrok account** (`tunnel.js`, needs `NGROK_AUTHTOKEN` in `.env.local`):

```
NGROK_AUTHTOKEN=<token> node tunnel.js                               # prints TUNNEL_URL=https://<host>
EXPO_PACKAGER_PROXY_URL=https://<host> npx expo start --offline
```

The free ngrok plan has one static domain per account. If a previous session didn't shut down cleanly, ngrok blocks with `ERR_NGROK_334`. `tunnel.js` retries automatically, and with `NGROK_API_KEY` (dashboard → API Keys) in `.env.local` it force-kills stale endpoints first.

**Expo's tunnel** (no ngrok account). Use this in the cloud workspace: its traffic goes through a proxy, and the free ngrok plan refuses to run behind one.

```
npm install -g @expo/ngrok@^4.1.0                                    # once
http_proxy=$HTTPS_PROXY npx expo start --tunnel --dev-client         # https://<id>-anonymous-8081.exp.direct
```

The Expo tunnel URL stays the same across restarts of the same checkout. Open the URL in Squidbox (Dev) via "Enter URL manually". Add `-c` to `expo start` to clear the cache after changing `.env.local` or upgrading packages.

### Local backend with mock data

The dev client can run against a local backend filled with stock photos, albums and posts, so testing never touches your real library. Metro forwards API and file requests to the local stack, so the phone needs only Metro's tunnel.

One-time setup (needs Docker):

1. In `apps/server/`: `cp .env.docker .env`, then `npm run local:setup` (Postgres + MinIO,
   migrations, local accounts).
2. Start Metro with a tunnel (see above) and note its URL. Expo's tunnel keeps the same URL for this
   checkout.
3. In `apps/server/.env`, set `S3_PUBLIC_ENDPOINT=<tunnel URL>`. Run `npm run dev`, then
   `npm run seed:mock`.
4. In `apps/mobile/.env.local`, set:
   ```
   EXPO_PUBLIC_API_URL=<tunnel URL>/api/v1
   LOCAL_BACKEND_URL=http://localhost:3100
   EXPO_PUBLIC_LOGIN_FORM_EMAIL=me@example.com
   EXPO_PUBLIC_LOGIN_FORM_PASSWORD=<SEED_USER_PASSWORD from apps/server/.env>
   ```
5. Restart Metro with `-c`, reload the dev client and sign in.

Later sessions: start Metro with its tunnel and `npm run dev` in `apps/server/`. If the tunnel URL
changed, update it in both env files. `npm run seed:mock` resets the account to exactly the mock set
at any time.

To go back to your real library, point `EXPO_PUBLIC_API_URL` at the live backend again, remove `LOCAL_BACKEND_URL`, restart Metro and sign in with your account. Signing in as a different account wipes the device's local data first, so the two libraries never mix.

If Docker pulls fail, or the server can't reach MinIO, see `apps/server/README.md` → "Local development".

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

- **Signing expires yearly.** The distribution certificate and the ad hoc provisioning profiles of both apps are valid until **Oct 10, 2027**. An installed app stops opening when its profile expires. The `build` skill covers renewing them.
- **Build downloads expire after 14 days.** EAS deletes internal build artifacts after about two weeks. `eas build:resign` only works within that window, after that you need a new build.
- Build/preview help: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/build/internal-distribution/
