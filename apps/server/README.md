# @squidbox/server

The TypeScript backend: Fastify + Drizzle + Postgres + S3, deployed on Fly.io (see the
`/deploy-server` skill). It serves:

- **Auth:** JWT access tokens (24h) plus per-device refresh tokens that rotate on every refresh. A
  rotated token stays valid for 10 minutes, until its successor is first presented, so a lost
  refresh response or two concurrent refreshes don't sign the device out; logout revokes both sides
  of a rotation. `authenticate` loads the token's user once per request and answers 401 for a user
  that no longer exists.
- **Identity:** `SERVER_ID`, a fixed uuid per deployment, reported by `/up`, login and `/me`. The
  app binds each session and its local library to it (`docs/sync-design.md` §8), so it must never
  change: a different id is another server to the app, with its own library.
- **Files:** presigned GET downloads, server-proxied streaming uploads with server-side multipart,
  and batch delete.
- **Sync:** `/sync/pull` and `/sync/push`.
- **AI:** `/ai/models` (Venice's live model list, cached 5 minutes) and the blind model compare
  `/ai/compare/writing` and `/ai/compare/vision`, behind Venice's chat API
  (`src/ai/`). `VENICE_API_KEY` is server-side only; without it the server runs and these routes
  answer 503 `ai_not_configured`. `VENICE_BASE_URL` defaults to `https://api.venice.ai/api/v1`.
  `AI_ALLOWED_EMAILS` (comma-separated) limits them to those accounts, others get 403
  `ai_not_allowed`; unset, every signed-in account may use them, so set it on Fly with the key.
  Locally, export the key in the shell that runs `npm run dev:local` (never in `.env.docker`); on
  Fly it is a secret (`fly secrets set VENICE_API_KEY=…`). Node's built-in `fetch` ignores
  `HTTPS_PROXY`: behind a proxy run Node ≥ 22.21 with `NODE_USE_ENV_PROXY=1`.

Everything is scoped per user.

## Design notes

- **Contract is shared, not hand-synced.** Request/response Zod schemas + inferred TS types
  live in `packages/shared` (`contracts/auth.ts`, `contracts/assets.ts`, `contracts/ai.ts`, …) and are imported by
  both server and app — one source of truth for the frontend and backend.
- **Modern API:** single error envelope `{ error: { code, message } }`, `Authorization:
  Bearer`, RESTful shapes, uuid ids.
- **Uploads are server-proxied streaming** (not direct-to-S3): Expo can't split large files
  for client-side multipart and a single S3 PUT caps at 5 GB. The client streams one binary
  PUT; the server multiparts it via `@aws-sdk/lib-storage`. The upload route has its own
  pass-through body parser, so the stream reaches S3 untouched whatever its content type. It also
  accepts `?token=` (redacted in logs) for iOS background uploads. Downloads are direct presigned GETs.
- **Multi-tenant isolation:** every S3 key is `keyPrefix + fileKey` derived from the auth
  token (per-user storage resolver); a client can't reach another tenant's objects.

## Local development (no AWS, no cloud DB)

A Docker Compose stack gives you Postgres + MinIO (S3-compatible) with the buckets pre-created,
so you can run everything — migrate, seed, the server, and the full smoke test — locally.

```
cd apps/server
cp .env.docker .env          # ready-made local config (throwaway creds; points at the stack)
npm install                  # from the repo ROOT (workspaces) if not already done
npm run local:setup          # docker compose up (Postgres + MinIO) + migrate + seed
npm run smoke                # login → upload (small + >210MB) → download → delete  ⇒ SMOKE: PASS
npm run verify:isolation     # two-device refresh + cross-tenant isolation  ⇒ ISOLATION: PASS
npm run dev                  # run the server against the local stack (http://localhost:3100)
```

First time only, if you don't have Docker: `brew install colima docker docker-compose` then
`colima start` (headless Docker runtime for macOS; local dev only).

MinIO comes from Chainguard's free images, because `minio/minio` isn't published on Docker Hub. If Docker
Hub answers pulls with 429 (anonymous rate limit, common on shared cloud IPs), run `docker login`.

MinIO console: http://localhost:9001 (minioadmin / minioadmin). Tear down with
`npm run compose:down` (keep data) or `npm run compose:reset` (wipe volumes).

`npm test` needs none of this — the unit + route tests mock the DB and S3.

### Mock data and the phone dev client

`npm run seed:mock` fills the local account (SEED_USER_EMAIL) with stock photos from picsum.photos
(landscape and portrait), short stock videos with music, albums (including Favorites and Deleted),
posts, and the assistant setup of the outdoor creator they belong to (Writing as you, the prompt
buttons, Favorites). Ids are deterministic, so re-running resets the account to exactly that set. It refuses to run
against a non-local API.

The videos are committed in `scripts/mock-videos/`: Mixkit clips with a Mixkit music track under
them, cut to 12 seconds, with their thumbnails and a `videos.json` of sizes and durations. To change
the set, edit `scripts/bake-mock-videos.sh` (needs ffmpeg) and run it, then the `MEDIA` list in
`scripts/seed-mock.ts`.

`S3_PUBLIC_ENDPOINT` makes the server sign download URLs for a public address (Metro's tunnel) while
it still talks to MinIO on localhost. `npm run dev:local` at the repo root sets it and starts the
whole phone setup; see the root README under "Local backend with mock data".

`--env-file` never overrides variables already in the shell. If your shell exports AWS
credentials, start the server with `env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY npm run dev`
(`npm run dev:local` does this for you).

## Setup (against real Postgres + AWS)

```
cp .env.example .env      # fill JWT_SECRET (random secret), SERVER_ID (uuid), DATABASE_URL, AWS_*, S3_SHARED_BUCKET
npm install               # from the repo ROOT (workspaces)
npm run db:generate -w @squidbox/server    # generate SQL migrations from the Drizzle schema
npm run db:migrate  -w @squidbox/server    # apply migrations + create the change_seq sequence
npm run db:seed     -w @squidbox/server    # seed the existing user + an isolation fixture user
```

## Run / test

```
npm run dev   -w @squidbox/server   # tsx watch (loads .env via your shell / --env-file)
npm test      -w @squidbox/server   # vitest — unit + route tests (no DB/S3 needed; mocked)
npm run smoke -w @squidbox/server   # end-to-end: login→upload(small+>210MB)→download→delete (needs real DB + S3)
```

`.env` is loaded by your shell or Node's `--env-file`; e.g. `node --env-file=.env` or
`tsx --env-file=.env src/index.ts`. Health check: `GET /up` → `{ "status": "ok", "serverId": "<uuid>" }`.
