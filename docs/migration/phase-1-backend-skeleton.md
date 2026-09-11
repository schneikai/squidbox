# Phase 1 — Backend skeleton (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).

## Objective

Build `apps/server` — the modern TypeScript backend: auth + S3 asset handling on a multi-tenant
schema, as a modernization rewrite (not byte-parity with Rails).

## Outcome

Done. `apps/server` = Fastify 5 + TS/ESM + Drizzle + Postgres + zod type provider: zod-validated
config, Drizzle schema (`users` uuid PK, per-device `refresh_tokens`, `change_seq` sequence), JWT
(HS256), bcryptjs passwords, refresh-token issue/rotate/revoke, Bearer auth, per-user storage
resolver (legacy per-user bucket vs shared bucket + `u/<id>/` prefix), S3 service, asset routes,
rate limiting, log redaction, `/up`, seed + smoke scripts. Contracts (Zod + inferred TS) live in
`packages/shared/contracts` — shared FE/BE source of truth.

Key architecture points that carried through:

- **Modern contract** — single error envelope `{ error: { code, message } }`, `Authorization:
  Bearer`, RESTful shapes/status codes, camelCase, uuid ids.
- **Uploads are server-proxied streaming** with server-side multipart (`@aws-sdk/lib-storage`) —
  NOT direct-to-S3 (Expo/RN can't split large files; a single S3 PUT caps at 5 GB). Downloads are
  direct presigned GETs.
- Local dev stack: `apps/server/docker-compose.yml` (Postgres + MinIO); `npm run local:setup`.

Verified: `tsc` clean, 40 vitest tests, `npm run smoke` PASS (incl. a >210 MB streaming multipart
upload) and `npm run verify:isolation` PASS (per-device refresh + cross-tenant isolation).
</content>
