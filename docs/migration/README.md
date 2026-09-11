# Migration — Overview (historical)

> **The migration is complete and deployed.** For the end state and known limitations, see
> [`STATUS.md`](./STATUS.md). This file is the concise historical overview of how it was done;
> the `phase-0..6-*.md` docs are a trimmed planning archive.

## What this was

Migrated the Squidbox backend from Ruby/Rails to an in-repo **TypeScript** backend built around
real **multi-device sync**, and ported the Expo app onto it. Target: **isolated multi-tenant** —
each user's private data syncs across that user's own devices only, no cross-user sharing
("just me now, open later"; see sync-design §2a). The sync engine design is
[`../sync-design.md`](../sync-design.md).

Key decisions taken along the way:

- **Modernization rewrite, not a byte-parity port.** Because app and server are collocated in
  this monorepo, the app's API client was updated to a clean modern contract (single error
  envelope `{ error: { code, message } }`, `Authorization: Bearer`, RESTful shapes, camelCase,
  uuid ids) rather than freezing old Rails wire quirks. Contracts are Zod schemas in
  `packages/shared`, shared by both sides.
- **Clean direct cutover.** The app was rewritten directly onto the new stack (SQLite source of
  truth + the new backend); the old Rails/JSON-blob path was removed, not kept behind a flag. The
  user's existing production build + backups were the external safety net during the work.
- **Real constraints honored.** Uploads are **server-proxied streaming** with server-side
  multipart (Expo/RN can't split large files for client-side S3 multipart — direct-to-S3 was
  tried and abandoned; see `apps/mobile/src/obsolete-code` and `phase-1`). Downloads are direct
  presigned GETs. Binaries never moved buckets during the migration.
- **Membership as edge collections.** Ordered membership (`album.assets`, `post.assetRefs`) was
  promoted out of the parent record into `album_assets` / `post_assets` edge collections
  (fractional-index `position`) so add/remove/reorder compose across devices. See
  [`edge-collections.md`](./edge-collections.md).

## Final repo layout

```
/apps/mobile      the Expo app (moved from repo root in Phase 0)
/apps/server      Fastify + TS backend (Fly.io + Neon Postgres)
/packages/shared  Zod collection descriptors + inferred types (the shared contract)
```

## Phase archive

The migration ran in phases; each `phase-N-*.md` is a trimmed record of that phase's objective and
outcome. All are done.

| # | Name | Outcome |
|---|------|---------|
| 0  | Foundation — monorepo, move app, TS/shared scaffold | done |
| 1  | Backend skeleton — auth + S3 + multi-tenant schema | done |
| 2a | Sync backend slice (`assets` endpoints + tests) | done |
| 2b | Sync client slice — SQLite + worker | done |
| 3a | Sync Inspector + observability | done |
| 3b | albums/posts + sync triggers | done |
| 4  | Converter — import real S3 backup (`legacy-import.md`, `/legacy-import`) | done |
| 5  | Cutover — deploy to Fly.io (`/deploy-server`), retire old path | done (droplet retirement is user-side, see `STATUS.md`) |
| 6  | Open registration | not built — private single-user build; plan doc kept if ever opened up |

Follow-on work after the phases: **edge collections** for membership
([`edge-collections.md`](./edge-collections.md)) and the **legacy import**
([`legacy-import.md`](./legacy-import.md)). The independent design review is
[`fable-review.md`](./fable-review.md).
</content>
