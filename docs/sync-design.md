# Sync Design

Squidbox syncs a user's library metadata across that user's devices with a small,
collection-based sync engine. The app keeps a full local copy in SQLite and talks to a Postgres
backend through two endpoints, pull and push. App and server share one contract, defined with
Zod in `packages/shared`.

Scope:

- **Isolated multi-tenant.** Many users, but each user's data is private and syncs only across
  that user's own devices. There is no sharing or co-editing between users. Conflicts can only
  happen between one person's devices, which is why whole-record last-write-wins is enough
  (§7). The isolation rules are in §2a.
- **Metadata only.** Photo and video files live in S3 and are not part of sync. Only their
  metadata records sync. Downloads use presigned S3 GET URLs; uploads stream through the server
  (`packages/shared/contracts/assets.ts`). How file deletion relates to tombstones is in §7a.

**Why a custom engine.** Off-the-shelf local-first stacks (WatermelonDB, PowerSync, ElectricSQL,
Replicache/Zero, Turso embedded replicas) each need a server write path anyway or add a
third-party sync service between the app and Postgres. Each device fully replicates one user's
data, so the protocol stays small enough to own, and owning it is what makes the Sync Inspector
(§13) possible. Cross-user sharing, partial replication or per-field merge would be reasons to
revisit this.

---

## 1. Core model

Everything synced is a **record** in a **collection**. Each collection is defined once by a
**descriptor** (§9). The engine (change tracking, pull, push, outbox, apply) does not know about
specific collections; it iterates the registry and dispatches by collection name. Adding a
collection is a short recipe (§9).

The registered collections are `assets`, `albums`, `posts`, `album_assets` and `post_assets`
(§10).

---

## 2. Record shape (base columns)

Every synced record, on server and client, carries:

| Field         | Type              | Set by     | Purpose                                                                                      |
| ------------- | ----------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `id`          | uuid string       | **client** | Record id. Client-generated so offline creates work. The server PK is `(user_id, id)` (§2a). |
| `createdAt`   | number (epoch ms) | writer     | Creation time.                                                                               |
| `updatedAt`   | number (epoch ms) | writer     | Logical clock for last-write-wins.                                                           |
| `deletedAt`   | number \| null    | writer     | Tombstone. Non-null means deleted.                                                           |
| domain fields | per collection    | writer     | The actual data.                                                                             |

`baseRecordSchema` in `packages/shared/collections/define.ts` defines these.

Server-only columns, never accepted from the client and stripped from pull and push responses
(`toWireRecord`):

| Column       | Type   | Purpose                                                            |
| ------------ | ------ | ------------------------------------------------------------------ |
| `user_id`    | uuid   | Owner. Always taken from the auth token.                           |
| `server_seq` | bigint | Per-write monotonic sequence. The pull cursor is based on it (§3). |

Client-only fields live only in local SQLite and are never synced (§4).

---

## 2a. Multi-tenant isolation (invariant)

- **Every syncable table has `user_id`**, set on the server from the auth token. A `user_id` in
  the request body is never used.
- **The server primary key is `(user_id, id)`.** Ids are client-generated, so a plain `id` PK
  would let a colliding uuid (reused on purpose or by accident) update another user's row. With
  the composite key the same push lands in the pusher's own partition. The push upsert uses
  `(user_id, id)` as its conflict target (§6). Local SQLite holds one user's data, so `id` alone
  is the local PK.
- **Every query is scoped.** Pull filters by the token's `user_id` (§5); push writes only with
  the token's `user_id`. No endpoint accepts a foreign `user_id`.
- **The advisory lock is per user** (§3), so one user's pushes never wait on another user's.
- **The cursor is per-device state** in the client's `sync_meta` table.
- **There are no cross-user references.** Album and post edges point only at the same user's
  assets.
- **S3 keys are namespaced per user.** `resolveStorage` (`apps/server/src/storage/resolver.ts`)
  picks the location from the authenticated user: a user with a `storage_bucket` uses that bucket
  with no prefix; everyone else uses the shared bucket under `u/<user_id>/`. The server prepends
  the prefix to the bare file key the client sends and rejects keys that try to escape it.

---

## 3. Change tracking and cursor

The server stamps every insert and update with `server_seq` from one global Postgres sequence,
`change_seq`. A `BEFORE INSERT OR UPDATE` trigger (`<collection>_server_seq`, function
`set_server_seq`) does it, so cursoring needs no per-collection code. `apps/server/src/db/migrate.ts`
creates the sequence and attaches the trigger to every registered collection on each migrate.

The client stores one `cursor`: the highest safe `server_seq` it has pulled. Pull selects rows
with `server_seq > cursor` (§5). A sequence is used instead of timestamps because timestamps
collide within a millisecond and suffer clock skew. The sequence is global, so one user's seqs
have gaps, which is harmless.

**Commit visibility.** `nextval` is assigned when a statement runs, but the row becomes visible
only at commit, and the two orders can differ. If transaction A takes seq 100 and B takes 101
and commits first, a pull could advance the cursor to 101 and never see 100. To prevent this,
every push transaction first takes a per-user advisory lock:
`pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`. Within one user's partition,
`server_seq` order then equals commit order, so the last seq a pull returns is a safe watermark.
Other users' commits can't hide or reorder this user's rows, and users never wait on each other.

**Invariant: every write to a syncable table goes through `push()`.** The legacy importer (§11)
does too. A write that skips the lock reopens the visibility gap; a write that skips the trigger
is never pulled. Together with "no hard deletes" (§7), this is a code-review rule.

---

## 4. Local-only vs synced fields

- `isFileSynced`, `isThumbnailSynced` and `isSynced` are **synced** fields. They are global facts
  ("the file is in S3"), not per-device state. After uploading a file, the uploading device
  deletes its local copy (`CloudSyncProvider`). If the flags were local-only, a second device
  would treat every asset as unuploaded and try to upload files it doesn't have. The cost: they
  ride whole-record LWW, so a concurrent offline edit on another device can briefly revert a
  flag. That only re-queues an upload to the same S3 key.
- `syncError` (this device's last upload error) is **local-only**. It is the only local-only
  field and lives on `assets`.
- Whether a file is cached on this device is not a field. It is read from the filesystem.

The descriptor's `localOnly` lists local-only fields. They are stripped before an outbox row is
written (`assetsRepository.ts`). A new device pulls metadata, including the real flag values,
and downloads files on demand.

---

## 5. Pull protocol

Paths in §5 and §6 are relative to `/api/v1` (so `/api/v1/sync/pull` and `/api/v1/sync/push`).
Both require authentication.

`POST /sync/pull`

```jsonc
// request
{ "cursor": 0, "limit": 1000 }   // cursor 0 = full sync; limit defaults to 500, max 1000

// response
{
  "changes": {
    "assets":       { "records": [ /* full rows, incl. deletedAt */ ] },
    "albums":       { "records": [] },
    "posts":        { "records": [] },
    "album_assets": { "records": [] },
    "post_assets":  { "records": [] }
  },
  "cursor": 1234,    // server_seq of the last included row
  "hasMore": false   // client loops until false
}
```

Server (`apps/server/src/sync/pull.ts`): for each collection, select up to `limit` rows with
`server_seq > cursor`, ordered by `server_seq`. Merge all lists by `server_seq`, cut at `limit`,
and return the `server_seq` of the last included row as the new cursor. Fetching `limit` per
collection before the cut means no row is skipped. `hasMore` is true if the merged list was cut
or any collection hit `limit`. Seqs are unique across collections, so there are no ties.
Tombstones flow like any other change.

Client apply (`apps/mobile/src/sync/worker.ts`) is **server-authoritative and outbox-guarded**:
an incoming record is applied only if that record has no pending outbox row. If it has one, the
record is skipped; the pending push re-asserts the local edit and the push result settles it
(§6). The client pulls pages until it holds about 5,000 records (or the server has no more), then
applies them in one SQLite transaction, as multi-row upserts by `id`, together with the new cursor.
Few big transactions matter on web, where every page a transaction touches is written again. A
crash before the commit re-pulls those pages; re-applying them is harmless. An update takes only
the synced columns the incoming record carries (`apps/mobile/src/sync/upsertRows.ts`), so a column
the server doesn't send yet keeps its local value.

The client never compares an incoming `updatedAt` with the committed local row. The server
clamps future timestamps (§7), so a device with a fast clock would hold local timestamps higher
than anything the server returns and would reject later edits from other devices forever. The
outbox is the only marker of "local state the server hasn't seen".

The worker runs push before pull and never runs two syncs at once (§8). This avoids a pull that
started before a push from briefly reverting the pushed edit.

**Tombstone retention.** Tombstones are kept forever. Nothing purges them, so any stored cursor
stays valid and late devices always learn about deletes. Per-user data is small.

---

## 6. Push protocol

`POST /sync/push`

Each mutation is a **whole-record upsert** of the synced fields, not a field delta. A request
holds at most 500 mutations; the client splits its outbox into batches of 500.

```jsonc
// request
{
  "mutations": [
    { "collection": "assets", "record": { "id": "…", "updatedAt": 1699, "deletedAt": null /* … */ } },
    { "collection": "albums", "record": { "id": "…", "updatedAt": 1700, "deletedAt": 1700 /* delete */ } }
  ]
}

// response: one result per mutation
{
  "results": [
    { "id": "…", "collection": "assets", "status": "applied" },
    { "id": "…", "collection": "albums", "status": "skipped-lww", "current": { /* server's record */ } },
    { "id": "…", "collection": "posts",  "status": "rejected", "reason": "schema:…" }
  ]
}
```

Server (`apps/server/src/sync/push.ts`), in one transaction that first takes the per-user
advisory lock (§3), for each mutation:

1. Reject an unknown collection (`unknown-collection`) or a record that fails the collection's
   Zod schema (`schema:<paths>`).
2. Clamp a future `updatedAt` to server time (§7).
3. Upsert in one atomic statement:
   `INSERT … ON CONFLICT (user_id, id) DO UPDATE SET … WHERE excluded.updated_at > <table>.updated_at`.
   `user_id` comes from the token. The update sets only the columns the record carries, so an
   optional column an older app doesn't send (e.g. `albums.position`) keeps its stored value. A new
   synced column is therefore added as optional, and the server ships before the app.
4. If a row came back, the result is `applied`. Otherwise the mutation lost LWW and the result is
   `skipped-lww` with the server's current record as `current`.

The comparison is strict `>`. The trigger re-stamps `server_seq` on every UPDATE, so an equal
timestamp must not count as newer; with `>` a replay is a true no-op and pushes can be retried
without dedup. Two different edits in the same millisecond keep the first one applied. The
client's monotonic clock (below) rules this out on one device.

`skipped-lww` must carry `current`. The winning row was usually already delivered by an earlier
pull and skipped on apply (the record had a pending outbox row, §5), and a pull from the stored
cursor won't deliver it again. Without `current` the losing device would never converge.

Client handling of each result (`planPushOutcome` in `apps/mobile/src/sync/pushPlan.ts`):

- `applied` or `skipped-lww` for a record edited again during the push (the outbox row's
  `updatedAt` is now newer than the pushed one): keep the row and do nothing; the next push
  settles it.
- `applied`: delete the outbox row and clear `syncError`.
- `skipped-lww`: write `current` to the local table, delete the outbox row, and log a conflict
  note (§13).
- `rejected`: keep the outbox row, set `syncError` on assets, and log the reason. A rejected
  edit is never silently dropped.
- A result that can't be applied (e.g. a malformed `current`) is handled like `rejected`: it runs
  in its own savepoint inside the batch's transaction, so it rolls back alone, keeps its outbox row
  and gets `syncError` and a log note, while the rest of the batch and the pull go on.

Push returns no cursor. The cursor only moves through pull (§3).

**Monotonic `updatedAt`.** Local writes set `updatedAt = max(now, previous + 1)`
(`nextUpdatedAt` in `apps/mobile/src/sync/clock.ts`). Without it, two edits to one record in the
same millisecond would tie and the second would be dropped. It also keeps a slightly-behind clock
from losing to this device's own earlier write.

**Outbox coalescing.** The outbox holds at most one row per `(collection, record_id)`; a newer
write replaces the payload (`enqueueMutations` in `apps/mobile/src/sync/outbox.ts`). The payload
leaves out the collection's local-only fields (`localOnly` in its shared descriptor).

---

## 7. Conflict resolution

- **Granularity:** whole-record last-write-wins by `updatedAt`. Conflicts only arise between one
  person's devices (§2a). The cost for scalar fields is in §14.
- **Deletes** are updates that set `deletedAt`, resolved by the same LWW. A newer edit beats an
  older delete (undelete) and the other way round. Restoring a deleted asset clears `deletedAt`.
- **Membership** (which assets are in an album or post, and their order) is stored as separate
  edge records in `album_assets` and `post_assets` (§10), not as arrays on the parent. Add,
  remove and reorder each write their own edge rows, so concurrent membership changes on two
  devices compose instead of one overwriting the other.
  - `position` is a fractional-index string key (`packages/shared/fractionalIndex.ts`). Edges
    sort by plain string comparison. Adding appends with `keyBetween(last, null)`. Reordering
    (and saving a post's asset list) assigns `initialKeys(n)` across the list and rewrites only
    the edges whose key changed.
  - Removing tombstones the edge. Deleting an album or post tombstones its edges too
    (`tombstoneParent`). Deleting an asset does not touch its edges; readers skip ids that
    don't resolve.
  - The app gives new edges random ids, so two offline devices adding the same asset can create
    two edges. The read path shows the asset once (§8), and removal tombstones every live edge
    for that asset.
  - Two concurrent reorders of the same list resolve edge by edge, so the result can mix both
    orders.
- **Clock skew:** the server clamps a future `updatedAt` to server time. The stored value can
  then differ from the sender's copy, which is harmless because apply is outbox-guarded (§5): the
  clamped record comes back on the next pull and replaces the local one. A device whose clock is
  behind can lose LWW with genuinely new edits until its clock catches up. That only affects its
  own user.
- **No hard deletes (invariant):** a SQL `DELETE` gets no `server_seq` and other devices never
  see it. Every repository delete sets `deletedAt` instead.

---

## 7a. Binary files and tombstones

- Deleting an asset tombstones its record, and it shows up in the Deleted album. The app never
  deletes the asset's S3 file or thumbnail; `POST /assets/delete` exists but the app does not call
  it. "Delete permanently" in the Deleted album (`deleteAssetsAsync`) only tombstones the records
  again, so those assets stay in the Deleted album and their files stay in S3.
- Applying an asset tombstone from pull does not delete this device's local file or thumbnail.
  Not implemented.
- The upload queue (`getUnsyncedAssets`) selects assets that are not `isSynced`, not deleted and
  have no `syncError`. It does not check that the local file exists; a missing file fails the
  upload and sets `syncError`.

---

## 8. Client architecture

Local store: **expo-sqlite + Drizzle**, accessed only through expo-sqlite's async API, the same
on iOS and web. `createDb` (`apps/mobile/src/sync/db/driver.ts`) puts Drizzle's async driver
(`sqlite-proxy`) on top of `expoExecutor.ts`; the tests put the same driver on better-sqlite3.

- **One queue.** Every statement runs through one queue, and a transaction holds it from BEGIN to
  COMMIT. So nothing interleaves with a transaction on the shared connection, and the
  "read previous row, write row + outbox" steps stay atomic without locks at call sites. Inside a
  transaction callback, code uses its `tx`; using `db` there would wait for the transaction itself.
- **Change notifications.** After each committed statement or transaction, the driver notifies
  listeners once with the tables it changed. A write that changed no rows and a rolled-back
  transaction notify nothing.

The app keeps one such database per **library** (`docs/library-ownership-plan.md`): the open
library's database is behind `getDb()` (`sync/db/client.ts`), opened and migrated by
`library/current.ts` when the library opens (`openAppDb` runs the SQLite migrations of
`apps/mobile/src/sync/db/migrations`), and `LibraryGate` (`App.js`) mounts the app under it, keyed
by the library, so nothing queries across a switch.

Tables (`apps/mobile/src/sync/db/schema.ts`):

- One table per collection: synced fields plus local-only fields.
- `sync_meta(key, value)`: `cursor`, `status`, `firstSyncDone`, `owner` (whose library this
  database is, JSON, so the library list can be rebuilt from the databases). `lastSyncUserId` is
  retired: read once by the install migration, never written.
- `outbox(id, collection, record_id, op, payload, updated_at, created_at)`: pending mutations,
  one row per record. `op` is `delete` when the payload has `deletedAt`, otherwise `upsert`.
- `sync_log`: recent sync runs (§13).

**Reads.** Nothing holds a whole table in memory. Each screen declares what it shows as a small
query descriptor and reads it live (`docs/paged-reads-plan.md`): `watchQuery.ts` runs a read once
and again after each committed write to the tables it watches, never overlapping, keeping the
object of every row whose fields are unchanged; `useLiveQuery` wraps it for a screen and pauses it
while the screen is blurred; `usePagedQuery` reads the first `limit` rows and the exact count of a
query and grows the limit as the user scrolls. The query builders (`assetQuery`, `albumQuery`,
`postQuery`) turn a descriptor into SQL with a stable order (every `ORDER BY` ends in `id`) over
the partial indexes of migration 0006; album stats and `lastPostedAt` are computed in SQL per read,
never stored or synced. Memoized grid cells re-render only for the rows a write touched.

The data providers (`AssetsProvider`, `AlbumsProvider`, `PostsProvider`) expose the write methods
to the screens; membership lives in the edge collections and is read where needed.

**Writes.** Each provider method calls a repository (`assetsRepository.ts`, `repository.ts`,
`edgesRepository.ts`). In one transaction it gives the records their next `updatedAt` (§6) and
stores them with their outbox rows through `saveRecords`, a few statements per 500 records. The
provider then calls `requestSync()`. Live reads pick up the change. Push results are applied in one
transaction per batch. The driver refuses a write whose table it can't tell, since live reads would
miss it.

**Sync worker** (`apps/mobile/src/sync/worker.ts`). One run is push, then pull:

1. Push all outbox rows in batches of 500 and handle each result (§6).
2. Pull from the stored cursor until `hasMore` is false, applying the pages in batches of about
   5,000 records (§5). Then set `firstSyncDone`.

Each run writes a `sync_log` entry and updates `status`. A failed run sets `phase: 'error'` with
`lastError`; the next trigger retries.

**Triggers:**

- After each local write (`requestSync()` from the providers).
- When the app comes to the foreground, and every 30 seconds while it is in the foreground
  (`useSyncTriggers.js`).
- When sync becomes active (app ready and signed in).

Background sync (`expo-background-task`) and server push notifications are not implemented.

**Session gating and exclusivity.** The worker is one single-flight queue
(`apps/mobile/src/sync/singleFlight.ts`). `requestSync()` coalesces into one trailing run, and
`withSyncPaused(work)` asks the running sync to stop at its next batch (push batch or applied pull
batch, so what ran is committed and the next run resumes), waits for it, and holds new ones until
`work` is done. Sync is active only while the app has finished init, the library is open AND
someone is signed in (`setSyncActive`, driven from one effect in `App.js`); every trigger above is
a no-op otherwise. A run is bound to the identity it started with, `{ libraryId, serverId,
userId }` (`library/sessionMatches.ts`): it runs only when the open library is the signed-in
account's, and every request reads the tokens fresh from the stored session for that identity
(`apiWithAuthentication`), so a mid-run refresh is picked up and another user's session is refused.

**Libraries and the session.** A library (one database plus its file folders) belongs to this
device or to an account on a server (`sync_meta.owner`, the list in `library/registry.ts`), and the
stored session is the open pointer: no session opens the device library, a session its owner's
(`library/sessionLibrary.ts`). Signing in or out changes the session and switches libraries inside
one `withSyncPaused` section (`library/switchLibrary.ts`: the backup run stopped, the closing
library's unsynced counts noted, its database closed, the next one opened), so no run spans a
session or library change. Nothing is wiped: the account's library is parked on sign-out and
reopens on the next sign-in with its cursor, outbox and first-sync flag; removing a library is an
explicit choice (the sign-out sheet, or Settings → Libraries). After a sign-in, the device
library's records can be added to the account once (`library/mergeLibrary.ts`: one transaction,
every copied record with its outbox row, files moved after the commit, the source removed when
nothing is left in it).

**Expired sessions.** Access tokens live 24h; refresh tokens rotate on every refresh, so the app
refreshes once for all concurrent callers (`refreshAccessTokenAsync`), and the server keeps a
rotated token valid until its successor is first presented, so a lost response doesn't sign the
device out. Only a server rejection (400/401/403) drops the tokens; network errors keep them. A
rejected session keeps its owner and library: the library stays open and editable, writes queue
in its outbox, nothing syncs, and Settings asks the owner to sign in again (`needsReauth`).

**First sync.** A new device or account starts at `cursor = 0` and pulls everything. While
signed in and `firstSyncDone` is not set, `AppGate` (`App.js`) shows `FirstSyncScreen` and does
not mount the data providers, so nothing competes with the bulk pull. The providers mount once
the pull has drained. Files download on demand.

---

## 9. Collection descriptor

Each collection is defined once in `packages/shared/collections/`:

```ts
// packages/shared/collections/asset.ts
export const assetCollection = defineCollection({
  name: 'assets',
  schema: baseRecordSchema.extend({
    // synced fields; base columns come from baseRecordSchema
    mediaLibraryAssetId: z.string(),
    mediaType: z.enum(['photo', 'video']),
    // …
    isFileSynced: z.boolean(), // global "file is in S3" facts, synced (§4)
    isThumbnailSynced: z.boolean(),
    isSynced: z.boolean(),
  }),
  localOnly: {
    syncError: z.string().nullable(), // this device's last upload error (§4)
  },
});
```

The descriptor drives Zod validation on push, the inferred TypeScript types on both sides, and
the registry (`registry.ts`) that the server's pull, push and migrate iterate. The Postgres and
SQLite tables are declared by hand per dialect from the same field list.

### Adding a collection

1. Add a descriptor in `packages/shared/collections/` and add it to `collections` and
   `CollectionName` in `registry.ts`.
2. Server: add the table in `apps/server/src/db/schema.ts` with `syncableBase()`, a composite
   `(user_id, id)` primary key and a `(user_id, server_seq)` index. Add it to `serverCollections`
   in `apps/server/src/sync/collections.ts`. Generate the Drizzle migration. `migrate.ts`
   attaches the `server_seq` trigger.
3. Client: add the table in `apps/mobile/src/sync/db/schema.ts` and to `clientCollectionTables`
   in `clientCollections.ts`, and generate the SQLite migration.
4. Add a sample record to the registry guard test.

Pull, push, outbox, apply and conflict handling then work unchanged.

**Guard rail.** The "collection registry guard" in `apps/server/test/sync.test.ts` runs for every
registered collection. It checks that the server collection exists, the `server_seq` trigger is
attached (`pg_trigger`), the primary key is `(user_id, id)`, a pushed record comes back on pull,
and another user's pull does not see it.

---

## 10. Collections

Timestamps are epoch-ms numbers. Booleans are integers in SQLite.

**assets** (asset metadata). Synced: `mediaLibraryAssetId`, `mediaType` (`photo` | `video`),
`width`, `height`, `fileSize`, `duration`, `filename`, `thumbnailFilename`, `isFavorite`,
`notes`, `oldFileId`, `isFileSynced`, `isThumbnailSynced`, `isSynced`, plus the base columns.
Local-only: `syncError`.

**albums**. Synced: `name`, `isFavorite`, `archivedAt`, `showInPostSuggestionsAfter`,
`oldCollectionName`, `notes`, `sortOrder` (null | `custom`), `smartAlbumType`
(null | `FAVORITES` | `DELETED`), `position` (optional, null | fractional-index key), plus the base
columns. Reordering an album's photos sets its `sortOrder` to `custom`. `position` is the album's
place in the albums list's custom order; albums without one come first, newest first.

**posts**. Synced: `text`, `isFavorite`, `postedAt`, `rePostId`, `isIgnoredForRepost`,
`suggestRepostAt`, `hasBeenReposted`, plus the base columns.

**album_assets** (album membership). Synced: `albumId`, `assetId`, `position`, plus the base
columns. One record per album and asset.

**post_assets** (assets in a post). Synced: `postId`, `assetId`, `position`, plus the base
columns. The edge id is the `assetRefs[].id` the UI sees.

Edges have a parent index on both sides (`album_assets_album_idx`, `post_assets_post_idx`).
References between collections are not enforced with foreign keys; the UI tolerates ids that
don't resolve.

Derived on-device, not synced: `album.assets`, `post.assetRefs`, and `postHistory` /
`lastPostedAt` on assets and albums (§8).

---

## 11. Legacy importer

Libraries from the old app are imported on the server, not on a device. The importer
(`apps/server/scripts/convert-legacy.ts`, logic in `apps/server/src/convert/`) reads the old JSON
backups (`assets.json`, `albums.json`, `posts.json`) from the user's S3 location. It converts old
ids to deterministic uuid v5 ids, maps records to the current schema (`isDeleted` becomes
`deletedAt`; the `is*Synced` flags carry over), and turns album `assets` and post `assetRefs`
arrays into `album_assets` / `post_assets` edges with `initialKeys` positions. Everything is
written through `push()`, so it is validated, LWW-upserted and `server_seq`-stamped like a client
push. The import is idempotent and safe to re-run. Asset files stay at their existing S3 keys.

Runbook: [`legacy-import.md`](./legacy-import.md), or the `/legacy-import` skill.

---

## 12. Key choices

- Push sends whole records, not field deltas.
- The cursor is a global `change_seq` stamped by a trigger, made safe by a per-user advisory
  lock (§3).
- Conflicts resolve by whole-record LWW (§7); membership is edge records (§10).
- Pull apply is outbox-guarded and server-authoritative (§5).
- `skipped-lww` returns the winning record, and the client adopts it (§6).
- Tombstones are kept forever (§5).
- Asset file flags are synced; only `syncError` is local-only (§4).
- Sync runs in the foreground and on each local write (§8).
- Users are isolated; there is no cross-user sharing (§2a).

---

## 13. Observability and the Sync Inspector

All sync state is local to the device and none of it syncs.

### Engine state

- **Status** in `sync_meta.status`: `{ phase: 'idle' | 'pushing' | 'pulling' | 'error',
lastPushAt, lastPullAt, lastError }`. The cursor is stored separately under `cursor`.
  `useSyncStatus` exposes both, plus the pending count, as live queries.
- **Outbox.** A record is pending if it has an outbox row. Pending counts are queried from the
  outbox overall and per collection.
- **File state.** `isFileSynced` and `isThumbnailSynced` (synced) and this device's `syncError`
  (local-only) on each asset.
- **Sync log.** `sync_log(ran_at, pushed, pulled, duration_ms, error, notes)` keeps the last 100
  runs. When a local change loses LWW, the run's notes say so
  (`albums <id>: local change overwritten by server`), so an override is never silent. Rejected
  mutations are noted with their reason.

### Sync Inspector

The "Library sync" screen (`apps/mobile/src/screens/SyncScreen.jsx`) shows:

- **Status:** current status, last sync time, and **Sync now**.
- **Developer:** cursor, pending count, and records / pending / tombstones for `assets`,
  `albums` and `posts`.
- **Sync log:** the last 30 runs with counts, duration, notes and errors.
- **Troubleshooting:**
  - **Rebuild from server** (`fullResync`): keeps the outbox, wipes the collection tables, resets
    the cursor and the first-sync flag, then pushes pending edits and pulls everything from
    `cursor = 0`. Wiping, not just resetting the cursor, removes local records the server doesn't
    have.
  - **Clear outbox**: discards pending edits. This can leave never-pushed records only on this
    device.

Both actions run with sync paused.

### Backend

Push and pull write structured logs tagged with `userId` (`apps/server/src/sync/routes.ts`).
Pull logs the from and to cursor, record count and `hasMore`. Push logs the mutation count and
the applied / skipped-lww / rejected tally. `GET /up` is the health check.

---

## 14. Known limitations

- **Scalar fields use whole-record LWW.** Concurrent edits to different fields of the same record
  (for example renaming an album on one device while favoriting it on another) keep only one
  writer's version. Membership doesn't have this problem because it is separate edge records. A
  per-field merge would be an additive change.
- **Derivation is a full recompute.** `derive.ts` rebuilds ordered membership, `postHistory`
  and `lastPostedAt` from all live rows whenever any of its input tables change. The providers
  mount only after the initial pull (`AppGate`), so the first sync isn't slowed by it.
  Incremental derivation is an option if it ever feels slow.
- File cleanup on delete is not implemented (§7a).
