# Phase 4 — One-shot converter (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).
> The current, maintained runbook is [`legacy-import.md`](./legacy-import.md) (skill:
> **`/legacy-import`**).

## Objective

Import the existing library from the old Rails S3 JSON backups (`assets.json`, `albums.json`,
`posts.json`) into the new backend, and validate the sync engine against real data.

## Outcome

Done and validated on the real library: 14,855 assets / 424 albums / 920 posts + membership edges.
The converter (server-side, `apps/server/scripts/convert-legacy.ts` + `src/convert/*`) downloads
the JSON from S3, canonicalizes all ids to **deterministic uuid v5** (so re-runs are idempotent and
references remap in lockstep), maps old→modern fields (`isDeleted`→`deletedAt`, `image`→`photo`,
rounds float timestamps), emits membership **edges** for `album_assets` / `post_assets`, and upserts
through the normal sync `push()` path. Asset **files** stay untouched in S3 under their existing
`filename` keys.

See [`legacy-import.md`](./legacy-import.md) for the full procedure, config, expected output, and
gotchas — that is the doc to use for any re-import.
</content>
