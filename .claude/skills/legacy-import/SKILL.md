---
name: legacy-import
description: Import a user's old Rails S3 JSON backups (assets/albums/posts) into the new backend — download from S3, canonicalize ids to uuids, map to the modern schema, upsert via sync push, and verify. Use when the user asks to import/convert/re-import legacy data, seed the backend with their real library, or test the converter against real data.
---

# Legacy data import

Full procedure, config, expected output, and gotchas live in **`docs/migration/legacy-import.md`** —
read it first; this skill executes it. The importer is **idempotent** (deterministic uuid v5 id
remap), so re-running is safe.

This is a **ONE-TIME, pre-launch data migration** — run once to load the existing Rails library
into the new backend before going live. It is NOT part of `/deploy-server` (that sets up hosting and
runs on every deploy; this runs once). Already completed for the current prod deploy; re-run only
if the DB is wiped/recreated or to re-test the converter. Same script (`scripts/convert-legacy.ts`),
two targets:

- **Deployed (Fly + Neon)** — the usual case once hosted. The env (AWS creds, `CONVERT_USER_EMAIL`,
  `SEED_USER_STORAGE_BUCKET`) is already set as Fly secrets, so just run it on the app:
  ```bash
  fly ssh console --app squidbox-server -C "npm run convert:prod"
  ```
- **Local (docker Postgres)** — for testing the converter against real data. Needs `apps/server/.env`
  with AWS creds + `CONVERT_USER_EMAIL`/`SEED_USER_STORAGE_BUCKET`, and the docker stack up
  (`npm run compose:up`):
  ```bash
  mise exec node@20.19.4 -- npm run db:migrate   # ensure schema
  mise exec node@20.19.4 -- npm run db:seed       # ensure the account exists
  mise exec node@20.19.4 -- npm run convert:legacy
  ```

## Steps

1. **Confirm the target** (deployed vs local) and that the account is seeded there (the seed sets the
   user + their `storage_bucket`; the importer needs the user to exist).
2. **Run** the matching command above. The importer is idempotent — safe to re-run. For a clean
   re-import with fresh counts, `TRUNCATE assets, albums, posts, album_assets, post_assets;` first.
3. **Check the verification block** it prints — must end with
   `OK — all ids canonical uuids and all references resolve.` Report the counts + any dropped dangling
   refs / rejections, and spot-check the samples (e.g. newest post).

## Notes

- Real ids in the source are a mix of nanoids and undashed hex → all canonicalized to uuids.
- Filenames (S3 object keys) are deliberately left untouched — do not rewrite them.
- See the runbook's "Gotchas" section for the float-timestamp and key-rotation caveats.
