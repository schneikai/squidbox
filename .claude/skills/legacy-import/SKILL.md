---
name: legacy-import
description: Import a user's old Rails S3 JSON backups (assets/albums/posts) into the new backend — download from S3, canonicalize ids to uuids, map to the modern schema, upsert via sync push, and verify. Use when the user asks to import/convert/re-import legacy data, seed the backend with their real library, or test the converter against real data.
---

# Legacy data import

Full procedure, config, expected output, and gotchas live in **`docs/migration/legacy-import.md`** —
read it first; this skill executes it. The importer is **idempotent** (deterministic uuid v5 id
remap), so re-running is safe.

## Steps

1. **Confirm prerequisites** with the user before running:
   - Which account to import (`CONVERT_USER_EMAIL`) and its S3 bucket (`SEED_USER_STORAGE_BUCKET`).
   - AWS credentials that can read that bucket. Have the user place them in `apps/server/.env`
     (gitignored) rather than pasting in chat; if they do paste, remind them to rotate afterward.
2. **Verify the docker stack** is up: from `apps/server`, `npm run compose:up` (Postgres + MinIO).
3. **Sanity-check S3 access** before the full run — HEAD the three keys (`assets.json`,
   `albums.json`, `posts.json`) in the bucket. If the objects aren't found, stop and re-check the
   bucket name / region / credentials.
4. **Run** (from `apps/server`, Node 20 via mise):
   ```bash
   mise exec node@20.19.4 -- npm run db:migrate
   mise exec node@20.19.4 -- npm run db:seed
   mise exec node@20.19.4 -- npm run convert:legacy
   ```
   For a clean re-import with fresh counts, `TRUNCATE assets, albums, posts;` first.
5. **Check the verification block** the script prints — it must end with
   `OK — all ids canonical uuids and all references resolve.` Report the counts and any dropped
   dangling refs / rejections to the user, and spot-check the samples (e.g. newest post).

## Notes

- Real ids in the source are a mix of nanoids and undashed hex → all canonicalized to uuids.
- Filenames (S3 object keys) are deliberately left untouched — do not rewrite them.
- See the runbook's "Gotchas" section for the float-timestamp and key-rotation caveats.
