# Legacy data import (Rails S3 backup → new backend)

One-shot importer that pulls the old Rails JSON backups (`assets.json` / `albums.json` /
`posts.json`) from a user's S3 bucket, canonicalizes all ids to uuids, maps the old shapes to the
modern schema, and upserts them through the normal sync `push()` path. After it runs, the user
logs in on-device and pulls everything down. **Idempotent** — safe to re-run.

> Invocable as the **`/legacy-import`** skill, which just executes this runbook.

## When you'd run this again

- Re-importing after wiping/recreating the backend database.
- Importing a different account's backup (set `CONVERT_USER_EMAIL` + its bucket).
- Re-testing the converter against real data after changing the mappers.

## Prerequisites

- Node 20 via mise (`mise exec node@20.19.4 -- …`).
- Docker stack up (Postgres + MinIO): from `apps/server`, `npm run compose:up`.
- **AWS credentials that can read the source bucket** (S3 `GetObject`). Read-only is enough.
- The target account's **S3 bucket name** (for the existing user it's their per-user bucket, e.g.
  `u41od6cqgqfo`; found in the Rails `db/seeds.rb` / credentials as `<user>_user_storage_bucket`).

## Configuration — `apps/server/.env` (gitignored)

```
DATABASE_URL=postgres://squidbox:squidbox@localhost:5432/squidbox   # docker Postgres target
AWS_REGION=eu-west-1                                                # source bucket region
AWS_ACCESS_KEY_ID=<read-capable key id>
AWS_SECRET_ACCESS_KEY=<read-capable secret>
# NOTE: leave S3_ENDPOINT UNSET so the S3 client talks to real AWS (setting it => MinIO).
S3_SHARED_BUCKET=squidbox-shared                                    # only used for new-user prefixing
SEED_USER_EMAIL=schneikai@gmail.com
SEED_USER_STORAGE_BUCKET=u41od6cqgqfo                              # the bucket holding the JSON backups
SEED_USER_PASSWORD=local-dev-password
CONVERT_USER_EMAIL=schneikai@gmail.com                             # whose backup to import
```

## Run

```bash
cd apps/server
mise exec node@20.19.4 -- npm run db:migrate    # ensure schema + triggers (idempotent)
mise exec node@20.19.4 -- npm run db:seed       # create the account (email -> storage bucket)
mise exec node@20.19.4 -- npm run convert:legacy # download JSON, remap ids, import, verify
```

To force a clean re-import (fresh counts) first: `TRUNCATE assets, albums, posts;`
(`docker compose exec -T postgres psql -U squidbox -d squidbox -c "TRUNCATE assets, albums, posts;"`).

## Expected output (real data, 2026-09)

```
Remapped ids: 14855 assets, 424 albums, 920 posts.
Dropped dangling refs -> albumAssets:12 albumPosts:0 assetPosts:0 postAssetRefs:0 rePostIds:0
assets: applied 14855, skipped 0, rejected 0
albums: applied 424, skipped 0, rejected 0
posts: applied 920, skipped 0, rejected 0
...
OK — all ids canonical uuids and all references resolve.
```

A re-run (without TRUNCATE) should report `applied 0, skipped <all>` — that's idempotency working.

## How it works (code map)

- `scripts/convert-legacy.ts` — orchestration: resolve user, read S3, remap, import, verify.
- `src/convert/remap.ts` — canonicalizes every id to a **uuid v5** (deterministic: same old id →
  same uuid, so re-runs are idempotent and references remap in lockstep). Drops refs to
  non-existent records.
- `src/convert/uuidv5.ts` — dependency-free RFC-4122 v5 (SHA-1 namespaced).
- `src/convert/legacy.ts` — old→modern field mapping (`isDeleted`→`deletedAt`, `image`→`photo`,
  rounds fractional epoch-ms timestamps to integers), then `push()`.
- `src/convert/verify.ts` — post-import referential + id-format check (spot-checks samples).
- Tests: `test/remap.test.ts` (pure), `test/convert.test.ts` (DB-backed, via `npm run test:db`).

## Gotchas learned the hard way

- **Ids are opaque client strings, not uuids in the source data** — a mix of 20-char nanoids and
  32-char undashed hex. The remap converts them all to canonical uuids; `getNewItemId()` in the app
  now also emits canonical uuids so new records match.
- **Filenames are NOT rewritten.** `filename` / `thumbnailFilename` embed the *old* id but are the
  real S3 object keys of the media — rewriting them would orphan the files. Only record ids change.
- **Some legacy timestamps are floats** (e.g. `1723483345552.0393`); the mapper rounds integer-typed
  columns (epoch-ms, sizes) — `duration` stays float (doublePrecision).
- **Rotate any AWS keys** you pasted into a chat/terminal afterward — treat them as exposed.
