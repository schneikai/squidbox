# Sync Design

Squidbox syncs a user's library metadata across that user's devices with a small,
collection-based sync engine. The app keeps a full local copy in SQLite and talks to a Postgres
backend through two endpoints, pull and push. App and server share one contract, defined with
Zod in `packages/shared`.

Scope:

- **Isolated multi-tenant.** Many users, but each user's data is private and syncs only across
  that user's own devices. There is no sharing or co-editing between users. Conflicts can only
  happen between one person's devices, and resolve field by field, the last writer winning (§7).
  The isolation rules are in §2a.
- **Metadata only.** Photo and video files live in S3 and are not part of sync. Only their
  metadata records sync. Downloads use presigned S3 GET URLs; uploads stream through the server
  (`packages/shared/contracts/assets.ts`). How file deletion relates to tombstones is in §7a.

**Why a custom engine.** Off-the-shelf local-first stacks (WatermelonDB, PowerSync, ElectricSQL,
Replicache/Zero, Turso embedded replicas) each need a server write path anyway or add a
third-party sync service between the app and Postgres. Each device fully replicates one user's
data, so the protocol stays small enough to own, and owning it is what makes the Sync Inspector
(§13) possible. Cross-user sharing or partial replication would be reasons to revisit this.

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
| `updatedAt`   | number (epoch ms) | writer     | Logical clock: the record's version, the newest of its fields' clocks (§7).                  |
| `deletedAt`   | number \| null    | writer     | Tombstone. Non-null means deleted.                                                           |
| domain fields | per collection    | writer     | The actual data.                                                                             |

`baseRecordSchema` in `packages/shared/collections/define.ts` defines these.

Server-only columns, never accepted from the client and never selected for pull and push responses
(`wireColumns`, the schema's fields):

| Column             | Type   | Purpose                                                                                       |
| ------------------ | ------ | --------------------------------------------------------------------------------------------- |
| `user_id`          | uuid   | Owner. Always taken from the auth token.                                                      |
| `server_seq`       | bigint | Per-write monotonic sequence. The pull cursor is based on it (§3).                            |
| `field_clock`      | jsonb  | Each clocked field's clock, `{ field: epochMs }` (§7). NULL when each is `updated_at`.        |
| `restored_through` | bigint | Assets (the final field's collection): the largest `deletedAt` a restore undid (§7), or NULL. |

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
does too. The one other write, the purge cleanup's server-only marker (§7a), takes the same lock
(`withUserLock`).
A write that skips the lock reopens the visibility gap; a write that skips the trigger
is never pulled. Together with "no hard deletes" (§7), this is a code-review rule.

---

## 4. Local-only vs synced fields

- `isFileSynced`, `isThumbnailSynced` and `isSynced` are **synced** fields. They are global facts
  ("the file is in S3"), not per-device state. After uploading a file, the uploading device
  deletes its local copy (`CloudSyncProvider`). If the flags were local-only, a second device
  would treat every asset as unuploaded and try to upload files it doesn't have. They merge as one
  field group (`fieldGroups` on the descriptor, §7): marking an upload sends all three with one
  clock, so they never mix two devices' values, and an edit of another field on another device
  leaves them alone. Two devices marking the same asset resolve by the last writer; at worst that
  re-queues an upload to the same S3 key.
- `syncError` (this device's last upload error) and `filesRemovedAt` (when this device removed a
  purged asset's files, §7a) are **local-only**, on `assets`.
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
an incoming record with a pending outbox row takes every field except the ones that row's `fields`
names (widened to their field groups when saved), which keep the values of the row's payload, with
the newer of the two `updatedAt`s, so this
device's next edit gets a clock above the pulled one; the pending push re-asserts those fields and
the push result settles them (§6), a purge included. So another device's favorite shows while a
rename made here waits to be pushed.
The client pulls pages until it holds about 5,000 records (or the server has no more), then
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

Each mutation carries the **whole record** (the full schema validates it, and an insert needs every
column) and `fields`: the fields its edits changed, each with its clock. The server merges only
those, field by field; a mutation without `fields` is a whole-record push (§7). A request holds at
most 500 mutations; the client splits its outbox into batches of 500.

```jsonc
// request
{
  "mutations": [
    { "collection": "assets", "record": { "id": "…", "updatedAt": 1699, "isFavorite": true /* … */ },
      "fields": { "isFavorite": 1699 } },
    { "collection": "albums", "record": { "id": "…", "updatedAt": 1700, "deletedAt": 1700 /* … */ },
      "fields": { "deletedAt": 1700 } },
    { "collection": "posts", "record": { "id": "…", "updatedAt": 1701 /* … */ } } // older app
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

1. Reject an unknown collection (`unknown-collection`), a record that fails the collection's
   Zod schema (`schema:<paths>`), or `fields` with a clock that isn't a whole epoch-ms number
   (`schema:fields`). The schema also rejects what Postgres can't store (a NUL in text, an integer
   out of its column's range), so a row the upsert refuses (`db:<sqlstate>`, step 3) is an
   unforeseen case. The record's id is looked up in lower case, as Postgres stores a uuid; the
   result names it as it was sent.
2. Find the clocks to merge (`sentFields.ts`): a `fields` key that isn't a merge field (§7) the
   record carries is dropped, a field group sent in part is widened to every member at the group's
   newest sent clock, and a future `updatedAt` or field clock is clamped to server time (§7).
3. Merge it into the stored record, read for the whole batch under the lock (`mergeRecord` in
   `packages/shared`, the rules in §7): each named field takes the pushed value when its clock is
   newer than the stored one (strict `>`), and its clock with it; every other field keeps its value
   and clock; `updated_at` becomes the newest clock. The row is written, with `user_id` from the
   token, only when a field applied; a new record is always written whole, whatever its `fields`
   name. So an optional column an older app doesn't send (e.g. `albums.position`) keeps its stored
   value; a new synced column is added as optional, and the server ships before the app.
   After the merges, the batch writes one multi-row upsert per collection (a row merged twice is
   written once, with its last merge), in one savepoint; `field_clock` is NULL when every clock is
   the row's `updated_at`, which reads back the same. The upsert never un-purges a row or sets its
   `updated_at` back, whatever it is given. A database error caused by a row itself (SQLSTATE class
   22 or 23, e.g. a constraint the schema doesn't mirror) rolls that savepoint back (the advisory
   lock, taken before it, stays held) and reruns the batch writing each row in its own savepoint,
   so that row alone is rejected as `db:<sqlstate>` and only such pushes pay the extra round trips.
   Any other error fails the whole push, which the client retries, and so does a violated `user_id`
   foreign key (the user was deleted mid-push).
4. A named field is lost when the row then holds another value for it (`lostFields`), and a push to
   a purged row whose record lacks that purge counts as lost too. None lost: `applied`. Any lost:
   `skipped-lww` with the merged row as `current`, which already holds the fields that applied, so
   the client adopts it.

The comparison is strict `>`. The trigger re-stamps `server_seq` on every UPDATE, so an equal
timestamp must not count as newer; with `>` a replay is a true no-op (and `applied`) and pushes can
be retried without dedup. Two different edits of a field in the same millisecond keep the first one
applied. The client's monotonic clock (below) rules this out on one device. Any field that applies
gets the row a new `server_seq`, so every device pulls the merged row.

`skipped-lww` must carry `current`. The winning row was usually already delivered by an earlier
pull while the record had a pending outbox row, so its contested fields kept the local values
(§5), and a pull from the stored cursor won't deliver it again. Without `current` the losing device
would never converge.

Client handling of each result (`planPushOutcome` in `apps/mobile/src/sync/pushPlan.ts`):

- Any result for a record edited again during the push (the outbox row's `updatedAt` is now
  newer than the pushed one): keep the row and do nothing; the next push settles it.
- `applied`: delete the outbox row.
- `skipped-lww`: write `current` to the local table, delete the outbox row, and log a conflict
  note naming the pushed fields `current` replaced (`overwrittenNote` in `worker.ts`, §13).
- `rejected`: keep the outbox row, record the reason in its `error`, and log it. A rejected
  edit is never silently dropped.
- A result that can't be applied (e.g. a malformed `current`) is handled like `rejected`: it runs
  in its own savepoint inside the batch's transaction, so it rolls back alone, keeps its outbox row
  and gets an `error` and a log note, while the rest of the batch and the pull go on.

**Failed rows wait.** The push skips outbox rows with an `error`. Every per-row failure is
deterministic (a schema or database rejection, a `current` this device can't store): pushing the
same payload to the same server fails the same way, so retrying it on every sync, or with backoff,
only repeats the failure. A failed row is pushed again when a new local edit replaces its payload
(`enqueueMutations` clears the `error`), and `retryFailures` (`outbox.ts`) clears every `error` on
launch (when `library/current.ts` opens the library, before it syncs), when the app returns to the
foreground (`retryFailuresAndSync` in `worker.ts`, which then syncs), and when the user taps Retry
All in the sync error viewer (§13). So a server fix or an app update gets a failure through without
anyone acting on it, even while the app stays resident for days; meanwhile the failed row also keeps
the pull from updating its record (§5). Failed uploads (`syncError`) are separate: only the Backup
screen's Retry All clears them (§8). A push that fails as a whole (network, server error) records
nothing on the rows; the run fails and the next trigger retries it.

Push returns no cursor. The cursor only moves through pull (§3).

**Monotonic `updatedAt`.** Local writes set `updatedAt = max(now, previous + 1)`
(`nextUpdatedAt` in `apps/mobile/src/sync/clock.ts`). Without it, two edits to one record in the
same millisecond would tie and the second would be dropped. It also keeps a slightly-behind clock
from losing to this device's own earlier write.

**Changed fields.** `saveRecords` (`apps/mobile/src/sync/saveRecords.ts`), which every local write
goes through, compares each record with the stored row its caller read and names the merge fields
that changed, widened to their field group, at the record's new `updatedAt`; a new record names
every field. A record that changes no synced field is neither written nor enqueued. An editor seeded
when it opens saves only the fields that differ from its seed (`changedValues`), so a field another
device changed meanwhile isn't sent back with a fresh clock.

**Outbox coalescing.** The outbox holds at most one row per `(collection, record_id)`; a newer
write replaces the payload, and its `fields` are merged into the row's with `json_patch`, so each
field keeps the clock of its own last edit (`enqueueMutations` in `apps/mobile/src/sync/outbox.ts`).
The payload leaves out the collection's local-only fields (`localOnly` in its shared descriptor).

---

## 7. Conflict resolution

- **Granularity:** per-field last-writer-wins. The **merge fields** are every synced field but
  `id`, `createdAt` and `updatedAt` (`mergeFields` in `packages/shared`), `deletedAt` included. The
  server keeps each field's clock in `field_clock`; a field without one (every field of a row
  written before per-field merge) takes the row's `updated_at`, so no data needed migrating, and the
  next write pins it. So does every field of a row whose `updated_at` is newer than all its clocks:
  a server without them wrote it since (a rollback), so rolling back and forward again is safe.
  `updated_at` stays the newest clock. Editing different fields of a record on two devices keeps
  both edits; editing the same field keeps the later one. Conflicts only arise between one person's
  devices (§2a).
- **Field groups:** fields that must change together are declared as a group on the descriptor
  (`fieldGroups`). An edit of one sends the whole group with one clock, and the server widens a
  partly sent group the same way (both through `widenToGroups`), so the group never mixes two
  devices' values. Assets have two: `isFileSynced`, `isThumbnailSynced`, `isSynced` (§4), and
  `deletedAt`, `purgedAt`.
- **Whole-record pushes** (an app from before per-field merge, the legacy importer) send no
  `fields`; the server merges every field they carry at their `updatedAt`, so they win or lose
  field by field like any push. Outbox rows from before per-field merge are marked `whole_record`
  (SQLite migration 0011) and pushed without `fields` too, an edit coalesced into one included; on
  the device they name every merge field of their payload, so the pull keeps all of them (§5).
- **Deletes** are updates that set `deletedAt`, which merges like any other field. An edit of a
  _different_ field on another device doesn't undelete (a favorite on the iPad doesn't bring back
  an album deleted on the phone, and a reorder doesn't bring back a removed edge); only a restore,
  which sends a newer `deletedAt: null`, does (a whole-record push still carries `deletedAt`, so
  a newer one undeletes). Restoring a deleted asset clears `deletedAt`.
- **Purges** ("Delete permanently", §7a) set `purgedAt`, the write-once `finalField`, sent with
  its deletion as one group, the deletion pair (`mergeRecord`):
  - **A restore beats a purge made of a deletion it undid.** A restore (a merge that takes
    `deletedAt` from a value to null) raises the row's `restored_through` to the `deletedAt` it
    undid. When the stored row is live (`deletedAt` null) and a purge's `deletedAt` is at most
    `restored_through`, the purge loses with its `deletedAt`, whatever the clocks: a device clock
    running ahead can't defeat a restore, and under clock skew a purge of an older deletion loses
    too, which keeps the photo. `restored_through` only grows. A restore a server without it took
    (a rollback) raises nothing, so a purge of that deletion then goes by its clock.
  - **A re-delete** lifts it: once the row is deleted again, a purge goes by the rules below,
    whether it was made of the new deletion or of one a restore undid.
  - Otherwise the pair goes by `deletedAt`'s clock (an offline delete and purge the server never had
    included); a purge older than the stored deletion still applies to a record still deleted,
    keeping the newer `deletedAt`; a purge without its deletion changes nothing.
  - A purged row is frozen, so a later restore loses.
  - A push without `fields` (the installed app, which removes its files at once, and its outbox
    rows carried over) gets no `restored_through` check: it keeps its whole-record rule. A record
    without `purgedAt` (an app from before purges) leaves the stored one.
- **Membership** (which assets are in an album or post, and their order) is stored as separate
  edge records in `album_assets` and `post_assets` (§10), not as arrays on the parent. Add,
  remove and reorder each write their own edge rows, so concurrent membership changes on two
  devices compose instead of one overwriting the other.
  - `position` is a fractional-index string key (`packages/shared/fractionalIndex.ts`). Edges
    sort by plain string comparison. Adding appends with `keyBetween(last, null)`. Reordering
    (and saving a post's asset list) assigns `initialKeys(n)` across the list and rewrites only
    the edges whose key changed.
  - Removing tombstones the edge. Deleting an album or post tombstones its edges too
    (`tombstoneParent`). Deleting or purging an asset does not touch its edges, so a restore puts
    it back where it was. Readers resolve edges through the asset: albums skip deleted assets, a
    post still shows a deleted one (it can come back) but never a purged one, and ids that don't
    resolve are skipped.
  - The app gives new edges random ids, so two offline devices adding the same asset can create
    two edges. The read path shows the asset once (§8), and removal tombstones every live edge
    for that asset.
  - Two concurrent reorders of the same list resolve edge by edge, so the result can mix both
    orders.
- **Clock skew:** the server clamps a future `updatedAt`, and each future field clock, to server
  time. The stored value can then differ from the sender's copy, which is harmless because apply
  is outbox-guarded (§5): the clamped record comes back on the next pull and replaces the local
  one. A device whose clock is behind can lose with genuinely new edits of a field until its clock
  catches up. That only affects its own user.
- **No hard deletes (invariant):** a SQL `DELETE` gets no `server_seq` and other devices never
  see it. Every repository delete sets `deletedAt` instead.

---

## 7a. Binary files and tombstones

- **Deleting** an asset tombstones its record, and it shows up in the Deleted album. Its files stay,
  in S3 and on every device (file, thumbnail and downloaded copy), also when the delete arrives
  through sync: a deleted asset can be restored, and the Deleted album shows its thumbnail.
- **Deleting permanently** in the Deleted album (`deleteAssetsPermanently` → `purgeAssets`) sets
  `purgedAt` (synced, final once the server has it: §7); the record stays as a permanent tombstone
  (§5). A purged asset shows nowhere, the Deleted album included. Its copies on this device (file,
  thumbnail and downloaded copy, `removeAssetFiles` in `library/fs.ts`) stay until the purge is
  confirmed: a restore can beat it (§7), and the asset then comes back here, files included.
- **One sweep removes the copies** (`sweepPurgedFiles`), by state: every purged asset this device
  hasn't removed the files of yet (`filesRemovedAt`, local-only), once its purge is confirmed. The
  sweep reads what that means from the library's database:
  - In a library that syncs, the purge came from the server (no pending outbox row carries its
    deletion pair), and nothing is swept until the library is fully pulled (`firstSyncDone`, which a
    full resync clears): before that, a live asset not pulled back yet could share a purged one's
    file name.
  - In a device library, at once, as nothing can restore it, unless a merge pass has copied its
    records into an account (the merge marker in its database, §8): then its purges wait like an
    account's.
  - A name another asset still uses (one whose purge isn't confirmed) is kept, as on the server.
  - It runs at the end of every sync run, after a purge and when a library opens; a failed removal
    leaves the asset for the next sweep, and a full resync sweeps again what it pulls. A purge
    undone (a pull, an adopted `current`, a library merge) clears `filesRemovedAt` (a trigger), so a
    later purge removes the copies made since.
- **The S3 file and thumbnail** of a purged asset are deleted by the server, after each push
  reply, one cleanup at a time per user (`cleanUpPurgedFiles` → `deletePurgedFiles` in
  `sync/purgedFiles.ts`). It selects the purged assets whose files it hasn't deleted yet by a
  server-only column, `files_deleted_at` (not in the shared schema, never on the wire), not by the
  synced file flags: a stale device can push outdated flags, and an upload can finish before its
  flags are pushed. It deletes their keys whatever the flags say (a missing key counts as
  deleted), one `DeleteObjects` request per 500 assets, in id order, in the user's own storage.
  For each batch it takes the user's lock, checks which keys an asset not purged still names
  (kept), deletes the rest and marks the assets whose keys are gone, all before releasing the
  lock, so no push can add an asset naming a key between the check and the delete. The marker
  write gets a new `server_seq` like any update (§3), so devices pull the unchanged record once
  more, at no cost. A key `fullKey` would refuse holds no file and is skipped; an asset with a key
  S3 reports an error for stays unmarked for the next cleanup without holding up the others; a
  failed request leaves its batch for the next push.
- **The upload route** refuses a key that only purged assets name with `410` before reading the
  body, and checks again once the file is stored, deleting it with `410` when the purge landed
  during the upload. With the cleanup deleting regardless of the flags, a purged asset's files
  can't stay in S3.
- The upload queue (`readUnsyncedIds`) selects assets that are not `isSynced`, not deleted, not
  purged and have no `syncError`; the backup run then skips any with an outbox row (§8). It does not
  check that the local file exists; a missing file fails the upload and sets `syncError`.

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

The app keeps one such database per **library** (the design record is
`docs/library-ownership-plan.md`; what is built is described here): the open library's database is
behind `getDb()` (`sync/db/client.ts`), opened and migrated by `library/current.ts` when the
library opens (`openAppDb` runs the SQLite migrations of `apps/mobile/src/sync/db/migrations`), and
`LibraryGate` (`App.js`) mounts the app under it, keyed by the library, so nothing queries across a
switch.

Tables (`apps/mobile/src/sync/db/schema.ts`):

- One table per collection: synced fields plus local-only fields.
- `sync_meta(key, value)`: `cursor`, `status`, `firstSyncDone`, `owner` (whose library this
  database is, JSON, so the library list can be rebuilt from the databases), `mergedInto` (the merge
  marker of a device library a merge pass copied, §7a). `lastSyncUserId`, from before libraries, is
  left unread.
- `outbox(id, collection, record_id, op, payload, fields, whole_record, updated_at, created_at,
  error)`: pending mutations, one row per record. `op` is `delete` when the payload has
  `deletedAt`, otherwise `upsert`. `fields` is the changed fields with their clocks (§6);
  `whole_record` marks a row from before per-field merge, pushed without them (§7). `error` is why
  the server rejected the payload (§6), null while it waits to be pushed.
- `sync_log`: recent sync runs (§13).

**Reads.** Nothing holds a whole table in memory. Each screen declares what it shows as a small
query descriptor and reads it live (`docs/paged-reads-plan.md`): `watchQuery.ts` runs a read once
and again after each committed write to the tables it watches, never overlapping, keeping the object
of every row whose fields are unchanged; a stopped watch's read still waiting in the db queue is
skipped, and `minInterval` coalesces a write burst's re-reads (the album list's, to about one a
second); `useLiveQuery` wraps it for a screen and pauses it while the screen is blurred;
`usePagedQuery` reads the first `limit` rows and the exact count of a query and grows the limit as
the user scrolls. The query builders (`assetQuery`, `albumQuery`, `postQuery`) turn a descriptor
into SQL with a stable order (every `ORDER BY` ends in `id`) over the partial indexes of migration
0006; album stats and `lastPostedAt` are computed in SQL per read, never stored or synced. Memoized
grid cells re-render only for the rows a write touched.

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
- When the app comes to the foreground (after retrying the failed pushes, §6), and every 30
  seconds while it is in the foreground (`useSyncTriggers.js`).
- When sync becomes active (app ready and signed in).

Background sync (`expo-background-task`) and server push notifications are not implemented.

**Session gating and exclusivity.** The worker is one single-flight queue
(`apps/mobile/src/sync/singleFlight.ts`). `requestSync()` coalesces into one trailing run, and
`withSyncPaused(work)` pauses the run gate (`sync/runGate.ts`, `pauseRuns`): every registered run,
sync and backup alike, is aborted (a sync at its next push batch or applied pull batch, so what ran
is committed and the next run resumes; a backup at its next step, the upload in flight included),
and `work` starts once they ended. Both kinds of run start through the gate (`startRun`), which
registers a run synchronously and starts none while a pause holds. The worker syncs the target
`App.js` sets from one effect, `setSyncTarget({ db, identity, library } | null)`: the open
library's database and folders and the identity of its signed-in owner, null until the app has finished init, the library
is open AND someone is signed in; every trigger above is a no-op without it. A run is bound to the open library and to the identity `{ serverId, userId }`
of the session at its start (`library/currentSyncIdentity.ts`, `library/sessionMatches.ts`): it
runs only when the open library is the signed-in account's, and every request reads the tokens
fresh from the stored session for that identity (`apiWithAuthentication` → `requireSession`), so a
mid-run refresh is picked up and another user's session is refused (`SessionChangedError`, which
the gate treats like an abort, not as an error; the 401 retry's refresh lets it through too, so a
session the server rejected ends the run the same way). `requireSession` also refuses tokens
bound to another API base URL.

**Libraries and the session.** A library (one database plus its file folders) belongs to this
device or to an account on a server (`sync_meta.owner`, the list in `library/registry.ts`), and the
stored session is the open pointer: no session opens the device library, a session its owner's,
with or without tokens (`library/sessionLibrary.ts`). The library lives on the device; an account
backs it up and keeps it in sync, and signing out only pauses that.

- **Without an account** the app fills the device library (`owner: { kind: 'device' }`), created on
  demand. It exists only before the first sign-in.
- **Signing in** switches libraries and then stores the session, inside one `withSyncPaused`
  section (`library/sessionLibrary.ts`; `library/switchLibrary.ts`: the closing library's database
  closed, the next one opened, the previous one reopened if the next won't open), so no run spans
  a session or library change, and a failed switch leaves the old session untouched, with nothing
  to revert. `CloudProvider.loginAsync` then navigates to Settings. The account's library is the
  parked one from an earlier sign-in, or a new empty one. Then whatever the device library holds
  joins it at once, with no prompt (`library/mergeRun.ts`, crash-safe and idempotent: the
  `mergedInto` marker on the source, in the list and, from the first pass that copies records, in
  its own database until a merge that keeps it is done; every record in one transaction of the
  target with its outbox row; files, found by listing the source's folders, moved into missing
  destinations after the commit; the source removed when nothing is left in it. A pending edit of a
  record the target has is merged into the target's row with `mergeRecord` against the target's
  pending clocks, and what applies goes into its outbox through `saveRecords` with the source's
  clocks; the files moved are those of the assets that end in the target live or with a purge still
  pending, never of one purged there for good). The same merge runs again at every boot while an
  unmerged device library exists
  (`mergeDeviceLibrary`, inside `withSyncPaused` after `resumeMerges`, which skips a marked source
  that is the open library and goes on after a failed one), so one that failed or that a crash
  interrupted finishes then. A device library with photos whose file lives in another account's
  storage is kept, recorded as `keptFor` the account once its merge completed, and never merged
  again, so it never joins a second account.
- **Signing out** drops the tokens and nothing else (`dropTokensAsync`, then a best-effort
  revoke): the same library stays open and editable, writes queue in its outbox and photos wait for
  the backup, and all of it uploads when its owner signs in again. Settings asks once, and only
  when something is pending or not backed up.
- **Signing in as another account** opens that account's library and parks the current one with
  its pending changes, until its owner signs in again. Nothing is wiped and nothing in the UI
  removes a library.

**On disk.** The install from before libraries is the library `squidbox`: `squidbox.db`,
`assetfiles/` and `assetthumbnails/` under the document directory, nothing moved. Every other
library `<id>` (a uuid) is `library-<id>.db` and `libraries/<id>/{files,thumbnails}/`; its
downloads cache is `downloads/<id>/` under the cache directory and goes with it
(`library/libraryPaths.ts`: the paths come from the id alone). Every path helper takes the library
as a required argument and never falls back to the open one: screens pass `useLibrary().paths`
(`LibraryProvider`), which can't change under them since everything below `LibraryGate` is keyed by
the library, and work outside React (a backup run, a merge, the sync worker) is handed the library
it started with, so a late write lands in its own library or fails, never in the next one. The
database needs no such handle: closing a library rejects every statement queued after it
(`driver.ts`). The list of libraries is the
AsyncStorage value `libraries` (`{ libraries: [{ id, owner, mergedInto?, keptFor? }] }`); a corrupt value is
moved aside and the list rebuilt from the owners the databases carry (`library/rebuildRegistry.ts`;
a database without one, left by a first open that crashed, holds nothing and is skipped); the list and the session record share one persisted store
(`utils/persistedStore.ts`).

**The session** is one record in SecureStore (`session`; localStorage on web):
`{ serverId, userId, email, apiBaseUrl, tokens }` (`utils/cloud-api/sessionStore.js`, one in-memory
copy changed only through `updateSession`). It binds the signed-in user to the server the tokens
came from: the server reports its `SERVER_ID` in `/up`, the login response and `/me`
(`apps/server/src/config.ts`). `serverId` and `userId` are always set, on the session and on every
account owner, and `sameAccount` matches both exactly: the same `userId` on a different `serverId`
is another account, with its own library. At boot, `initializeCloudAsync` verifies the session
beside the library open (`library/bootLibrary.ts`): with the same base URL the app is signed in at
once, offline included; a changed base URL (a new dev tunnel) must report the session's `serverId`
in `/up` before the session rebinds to it, else the tokens are dropped; a network error leaves
everything for the next launch. Either way the session keeps its owner, so the library opened
beside the check stays open. Installs converted from before the session record could still hold an
owner without its `serverId`; until every such phone has booted once, `library/resolveOwners.ts`
copies the stored session's `serverId` into that user's unresolved owners right after the list
loads, before any library opens (reported to Sentry when it fires).

**Photo backup** (`sync/backupRun.ts`, started from `CloudSyncProvider`) uploads the files of the
assets unsynced at its start, one run at a time, for the library and identity it started with: each
asset is re-read right before its upload, its file and thumbnail upload at once and what uploaded is
marked in one write, every upload reads the tokens fresh for that identity, and `withSyncPaused`
aborts the run (the upload in flight included) before any session or library change; it registers
with the gate before it reads the ids, so a pause starting meanwhile stops it. An interrupted or
refused upload leaves its part unmarked, the file in place and no `syncError`, so the next run
uploads it; a part that finished before the abort is still marked (the pause waits for the run). A
refusal for another session marks nothing; an asset deleted or purged during its uploads isn't
marked and keeps its file; a failed upload or marking write sets `syncError` and the run goes on.
An asset with an outbox row, pending or failed (§6), is skipped until the server has confirmed its
record: the run deletes the local original once the file is uploaded, so the server must have the
asset first (it never loses a record it applied, §5), and an asset whose push keeps failing isn't
uploaded again on every run. Its push failure shows on the Library sync screen (§13).

**Expired sessions.** Access tokens live 24h; refresh tokens rotate on every refresh, so the app
refreshes once for all concurrent callers (`refreshAccessTokenAsync`), and the server keeps a
rotated token valid for 10 minutes, until its successor is first presented, so a lost response or
two concurrent refreshes don't sign the device out. Only a server rejection (400/401/403) drops
the tokens; network errors keep them. A rejected session keeps its owner and library, like a
sign-out: the library stays open and editable, writes queue in its outbox, nothing syncs, and the
only signs are the badge on the header avatar and Settings' "Backup paused · Sign in to continue"
row above the pre-filled sign-in form (`needsReauth`; "Sign in as someone else" opens that
account's library instead). No alert.

**First sync.** A new device or account starts at `cursor = 0` and pulls everything. While
signed in and `firstSyncDone` is not set, `AppGate` (`App.js`) shows `FirstSyncScreen` and does
not mount the data providers, so nothing competes with the bulk pull. The providers mount once
the pull has drained. Files download on demand. A sign-out there stops the pull at its next batch;
the library keeps what it pulled and the next sign-in resumes from the committed cursor.

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
  fieldGroups: [
    ['isFileSynced', 'isThumbnailSynced', 'isSynced'], // each group merges as one (§7)
    ['deletedAt', 'purgedAt'],
  ],
  finalField: 'purgedAt', // write-once, freezes the record (§7)
});
```

The descriptor drives Zod validation on push, the inferred TypeScript types on both sides, and
the registry (`registry.ts`) that the server's pull, push and migrate iterate. The Postgres and
SQLite tables are declared by hand per dialect from the same field list.

### Adding a collection

1. Add a descriptor in `packages/shared/collections/` and add it to `collections` and
   `CollectionName` in `registry.ts`.
2. Server: add the table in `apps/server/src/db/schema.ts` with `syncableBase()` (which brings
   `field_clock`), a composite `(user_id, id)` primary key and a `(user_id, server_seq)` index. Add
   it to `serverCollections` in `apps/server/src/sync/collections.ts`. Generate the Drizzle
   migration. `migrate.ts` attaches the `server_seq` trigger.
3. Client: add the table in `apps/mobile/src/sync/db/schema.ts` and to `clientCollectionTables`
   in `clientCollections.ts`, and generate the SQLite migration.
4. Add a sample record to the registry guard test.

Pull, push, outbox, apply and conflict handling then work unchanged.

**Guard rail.** The "collection registry guard" in `apps/server/test/sync.test.ts` runs for every
registered collection. It checks that the server collection exists, the `server_seq` trigger is
attached (`pg_trigger`), the table has `field_clock`, the primary key is `(user_id, id)`, a pushed
record comes back on pull, another user's pull does not see it, and a per-field delete comes back
as a tombstone, without its clocks, and is a no-op when replayed.

---

## 10. Collections

Timestamps are epoch-ms integers (the push rejects a fractional value per record, as the server
stores them in bigint columns). Booleans are integers in SQLite.

**assets** (asset metadata). Synced: `mediaLibraryAssetId`, `mediaType` (`photo` | `video`),
`width`, `height`, `fileSize`, `duration`, `filename`, `thumbnailFilename`, `isFavorite`,
`notes`, `oldFileId`, `isFileSynced`, `isThumbnailSynced`, `isSynced`, `purgedAt` (optional,
null | epoch ms: deleted permanently, §7), plus the base columns. Local-only: `syncError`.

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

- Push sends whole records plus the fields each edit changed, with their clocks (§6).
- The cursor is a global `change_seq` stamped by a trigger, made safe by a per-user advisory
  lock (§3).
- Conflicts resolve by per-field LWW, with field groups for fields that change together; a delete
  is a field, so only a restore undeletes (§7). Membership is edge records (§10).
- Pull apply is server-authoritative and outbox-guarded per field (§5).
- Pushes without `fields` merge as whole records, so the server ships before the app (§7).
- `skipped-lww` returns the winning record, and the client adopts it (§6).
- Tombstones are kept forever (§5); a purge is a final tombstone that wins over LWW, except over a
  restore it hadn't seen (§7).
- Asset file flags are synced; `syncError` and `filesRemovedAt` are local-only (§4).
- A rejected push waits on its outbox row, with its reason; it is retried on launch and when the
  app returns to the foreground, on a new edit, or Retry All (§6).
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
  outbox overall and per collection; `useSyncStatus` also counts the failed rows.
- **File state.** `isFileSynced` and `isThumbnailSynced` (synced) and this device's `syncError`
  (local-only) on each asset.
- **Sync log.** `sync_log(ran_at, pushed, pulled, duration_ms, error, notes)` keeps the last 100
  runs. When a local change loses, the run's notes name the fields the server's record replaced
  (`albums <id>: name overwritten by server`), so an override is never silent. Rejected
  mutations are noted with their reason each time they are pushed (§6).

### Sync errors

Settings' "Library sync" row reads "N errors" while outbox rows have failed (and "Photo backup"
counts the assets whose upload failed). The sync error viewer
(`features/cloud-sync/cloud-sync-control/SyncErrorViewer.jsx`) lists either kind with what failed
and why, with Retry All: from the Library sync screen the failed pushes (`readPushFailures`, named
after the record: `Album "Trips"`, `Post "First words…"`, `Photo in album "Trips"`), from the Backup
screen the failed uploads. The viewer closes itself once nothing has failed. Only Clear outbox
(below) gives up on a failed push; Rebuild from server keeps the outbox, failed rows included, and
puts their edits back, so they still wait.

### Sync Inspector

The "Library sync" screen (`apps/mobile/src/screens/SyncScreen.jsx`) shows:

- **Status:** current status, last sync time, **View errors** (above, while pushes have failed)
  and **Sync now**.
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

- **A field is the unit of merge.** Concurrent edits of the same field (two devices editing an
  album's notes) keep only the later writer's version; text is not merged within a field. Fields
  that depend on each other must be declared as a group (§7), or two devices' edits can combine
  into a mix neither made.
- **Whole-record pushes** from an older app carry every field as changed (§7).
- **Derived values are computed per read.** Album stats and `lastPostedAt` are SQL in the paged
  queries (§8), so nothing is recomputed in JavaScript when a table changes.
