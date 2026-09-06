# @squidbox/server

The modern (2026) TypeScript backend — Fastify + Drizzle + Postgres + S3. Replaces the legacy
Rails API. Phase 1 delivers **auth** (JWT access + per-device refresh tokens) and the **S3
asset layer** (presigned GET downloads, server-proxied streaming uploads with server-side
multipart, batch delete), multi-tenant-ready. Sync endpoints arrive in Phase 2.

Not wired into the app yet — the app still talks to Rails until Phase 2b.

## Design notes

- **Contract is shared, not hand-synced.** Request/response Zod schemas + inferred TS types
  live in `packages/shared` (`contracts/auth.ts`, `contracts/assets.ts`) and are imported by
  both server and app — one source of truth for the frontend and backend.
- **Modern API:** single error envelope `{ error: { code, message } }`, `Authorization:
  Bearer`, RESTful shapes, uuid ids. See `docs/migration/phase-1-backend-skeleton.md`.
- **Uploads are server-proxied streaming** (not direct-to-S3): Expo can't split large files
  for client-side multipart and a single S3 PUT caps at 5 GB. The client streams one binary
  PUT; the server multiparts it via `@aws-sdk/lib-storage`. The upload route also accepts
  `?token=` (redacted in logs) for iOS background uploads. Downloads are direct presigned GETs.
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

MinIO console: http://localhost:9001 (minioadmin / minioadmin). Tear down with
`npm run compose:down` (keep data) or `npm run compose:reset` (wipe volumes).

`npm test` needs none of this — the unit + route tests mock the DB and S3.

## Setup (against real Postgres + AWS)

```
cp .env.example .env      # fill JWT_SECRET (Rails secret_key_base), DATABASE_URL, AWS_*, S3_SHARED_BUCKET
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
`tsx --env-file=.env src/index.ts`. Health check: `GET /up`.
