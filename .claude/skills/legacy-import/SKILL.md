---
name: legacy-import
description: Import a user's old app backups (assets/albums/posts JSON in S3) into the backend — download from S3, canonicalize ids to uuids, map to the current schema, upsert via sync push, and verify. Use when the user asks to import/convert/re-import legacy data, seed the backend with their real library, or test the converter against real data.
---

# Legacy data import

The procedure, configuration, output and code map live in **`docs/legacy-import.md`**. Read it
first; this skill executes it. The import is idempotent, so re-running is safe. It is separate from
`/deploy-server`.

## Steps

1. **Confirm the target**: the deployed backend (Fly) or the local Docker stack. The account must
   exist there; `db:seed` creates it and links its storage bucket.
2. **Run** the matching command from the doc. For fresh counts, truncate the five collection tables
   first.
3. **Check the verification output.** It must end with
   `OK — all ids canonical uuids and all references resolve.` Report the per-collection counts and
   any dropped references or rejections.

Never rewrite `filename` / `thumbnailFilename`; they are the media's S3 object keys.
