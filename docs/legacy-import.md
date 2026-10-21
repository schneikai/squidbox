# Legacy data import

The importer loads a user's old app backups (`assets.json`, `albums.json`, `posts.json` in their S3
bucket) into the backend. It canonicalizes every id to a uuid, maps the old shapes to the current
schema (including album and post membership edges), and upserts everything through the normal sync
`push()` path. The user then signs in on the device and pulls the library down.

The import is idempotent: ids are derived deterministically, so a re-run changes nothing. The
`/legacy-import` skill runs this procedure.

Typical reasons to run it: the backend database was recreated, another account's backup needs
importing (`CONVERT_USER_EMAIL` plus its bucket), or the mappers changed and need testing on real
data.

## Targets

**Deployed (Fly + Neon).** AWS credentials, `CONVERT_USER_EMAIL` and `SEED_USER_STORAGE_BUCKET` are
Fly secrets, so it runs on the app:

```bash
fly ssh console --app squidbox-server -C "npm run convert:prod"
```

**Local (Docker Postgres).** Start the stack from `apps/server` with `npm run compose:up`, then
configure `apps/server/.env`:

```
DATABASE_URL=postgres://squidbox:squidbox@localhost:5432/squidbox
AWS_REGION=eu-west-1                       # region of the source bucket
AWS_ACCESS_KEY_ID=<key that can read the source bucket>
AWS_SECRET_ACCESS_KEY=<secret>
# Leave S3_ENDPOINT unset: the importer reads from real AWS, not MinIO.
S3_SHARED_BUCKET=squidbox-shared
SEED_USER_EMAIL=<account email>
SEED_USER_STORAGE_BUCKET=<the per-user bucket holding the JSON backups>
SEED_USER_PASSWORD=<local password>
CONVERT_USER_EMAIL=<account whose backup to import>
```

```bash
npm run db:migrate       # schema + triggers (idempotent)
npm run db:seed          # creates the account and links its storage bucket
npm run convert:legacy   # download, remap ids, import, verify
```

For a clean import with fresh counts, truncate first:

```bash
docker compose exec -T postgres psql -U squidbox -d squidbox \
  -c "TRUNCATE assets, albums, posts, album_assets, post_assets;"
```

## Output

The importer prints how many ids it remapped, how many dangling references it dropped, and the
applied, skipped and rejected count per collection. It ends with:

```
OK — all ids canonical uuids and all references resolve.
```

On a re-run without truncating, nothing changes: a replay holds. Every record reports as applied,
except one edited since in the app, which reports as skipped (skipped-lww: the newer row stays).

## Code map

- `scripts/convert-legacy.ts` resolves the user, reads S3, remaps, imports and verifies.
- `src/convert/remap.ts` turns every id into a deterministic uuid v5, so references remap in
  lockstep. It drops references to records that don't exist.
- `src/convert/uuidv5.ts` is a dependency-free RFC 4122 v5 implementation.
- `src/convert/legacy.ts` maps old fields to current ones (`isDeleted` → `deletedAt`, `image` →
  `photo`, fractional epoch-ms timestamps rounded to integers) and calls `push()`.
- `src/convert/verify.ts` checks id formats and referential integrity after the import.
- Tests: `test/remap.test.ts` (pure) and `test/convert.test.ts` (needs Postgres, `npm run test:db`).

## Notes

- Source ids are a mix of 20-character nanoids and 32-character undashed hex. All become uuids.
- `filename` and `thumbnailFilename` keep the old ids. They are the real S3 object keys of the
  media, so rewriting them would orphan the files.
- Integer columns (timestamps, sizes) are rounded; `duration` stays a float.
- AWS keys used for an import are sensitive. Rotate them if they were shared anywhere.
