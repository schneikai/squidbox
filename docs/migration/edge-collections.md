# Edge collections for membership (album↔asset, post↔asset)

Fixes the whole-record-LWW membership loss (add-vs-reorder) by promoting the two ordered,
user-reorderable membership arrays out of the parent record into their own syncable collections.
Each membership is an independent record, so add / remove / reorder touch different rows and
compose across devices via the *existing* sync engine — no protocol change.

3-way / per-field merge for scalar fields is a separate, additive change (deferred).

## Scope

Convert (ordered, reorderable → edges):
- `album.assets`  → `album_assets` collection
- `post.assetRefs` → `post_assets` collection

Remove from synced state entirely (derive on-device):
- `album.postHistory`, `asset.postHistory`, and `lastPostedAt` on both — these are a denormalized
  cache, fully recomputable from posts + membership (exactly what `useRecalculatePostHistory` does).
  Syncing them is what makes them lossy (two devices each append a different post id → LWW drops
  one). Posts are independent records that never conflict, so deriving history is lossless. The
  existence of a "repair drifted postHistory" tool is proof the stored cache is a liability.

## Edge record shape

`album_assets`: base (`id`, `createdAt`, `updatedAt`, `deletedAt`) + `albumId`, `assetId`, `position`.
`post_assets`:  base + `postId`, `assetId`, `position`.

- **id** is deterministic: `uuidv5("<parentId>:<assetId>")` for album edges; for posts, reuse the
  existing `assetRefs[].id` sub-id. Deterministic ids ⇒ two devices adding the same asset converge
  on one row (idempotent), and add→remove→re-add reuses the row.
- **position** is a fractional-index string (lexicographic order key). Insert-between mints a key
  strictly between neighbors, touching only the moved edge — concurrent reorders/inserts don't
  collide. Shared util `fractionalIndex.ts` (`keyBetween(a, b)`), used by converter + client.
- **remove** = set `deletedAt` (tombstone); never hard-delete. Read path filters tombstones.

## Data model changes

- Drop `assets` from `albums`, `assetRefs` from `posts` (both stores + shared schema).
- Register `album_assets`, `post_assets` in the shared registry → server_seq trigger auto-attached
  (migrate.ts) and client generic pull/push pick them up.

## Read path (client)

Provider synthesizes the ordered `album.assets` / `post.assetRefs` arrays from live edge rows
(filter `deletedAt IS NULL`, sort by `position`) before handing records to the UI, so the dozens
of existing consumers keep seeing a plain ordered array.

## Converter / backfill

`convert/legacy.ts`: after mapping parents, emit one edge mutation per array element with an evenly
spread initial `position`; drop the arrays from the parent records. Re-run `legacy-import`.

## Slices

1. **Backend (testable headlessly):** shared descriptors + `fractionalIndex.ts` + tests; server
   tables + registry + migration; converter edges; server tests; re-import + verify.
2. **Client (device gate):** SQLite edge tables + migration; edge repository (keyBetween add/move,
   tombstone remove); read-path synthesis; AlbumsProvider / posts provider rewiring.
