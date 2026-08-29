# Sync Design

Design for the generic, collection-based sync engine that replaces the JSON-blob
backup/restore. Goal: transparent multi-device sync (Apple-Photos-like) that is
**easy to extend with new collections**, runs in Expo without ejecting, and shares
its contract between app and backend via Zod.

Scope assumptions:

- **Isolated multi-tenant**: multiple users, but each user's data is fully private and
  syncs only across **that user's own devices** — no sharing or co-editing between users
  ("just me now, open later"). Conflicts therefore only ever occur among one user's own
  devices, which is what lets us use whole-record last-write-wins instead of CRDTs — every
  LWW/conflict argument in this doc is **per-user** and unaffected by how many users exist.
  See §2a for the isolation invariant.
- Photos/videos ("asset files") already live in S3 and are **not** part of metadata
  sync — only their metadata records sync. Files move via the existing presigned
  upload/download flow. (Binary lifecycle vs tombstones: §7a.)

**Build vs adopt.** Off-the-shelf local-first stacks were considered (WatermelonDB,
PowerSync, ElectricSQL, Replicache/Zero, Turso embedded replicas). All were rejected for
this project: each still requires writing the server write path and/or adds a third-party
sync service between the app and Postgres, which directly conflicts with the "good
visibility into sync" and "keep it simple to operate" constraints; several have immature or
native-module-heavy Expo/RN stories. At this scale (each device fully replicates one
user's own data) the protocol below is small enough to own (~hundreds of lines), and
owning it is what makes the Sync Inspector (§13) possible. Reconsider adoption if
requirements ever grow to **cross-user sharing/co-editing**, partial replication (a
user's data too big to fully sync), or per-field merge — see the review doc
(`migration/fable-review.md`).

---

## 1. Core model

Everything synced is a **record** in a **collection**. A collection is defined once by a
**descriptor**. The sync engine (change tracking, pull/push, outbox, apply, reactivity)
is collection-agnostic and dispatches by collection name. Adding a collection is a small
recipe (§9), not new plumbing.

The three initial collections — `assets`, `albums`, `posts` — are just the first
registered collections.

---

## 2. Record shape (base columns)

Every synced row, in both Postgres (server) and SQLite (client), carries:

| Column       | Type            | Who sets it | Purpose |
|--------------|-----------------|-------------|---------|
| `id`         | string (uuid)   | **client**  | Record id. Client-generated so offline creates work. **Server PK is composite `(user_id, id)`** — see §2a. |
| `created_at` | number (epoch ms) | writer    | Creation time. |
| `updated_at` | number (epoch ms) | writer    | Logical clock for last-write-wins. |
| `deleted_at` | number \| null  | writer      | Tombstone. Non-null = deleted. |
| …domain fields… | per collection | writer   | The actual data. |

Server-only columns (never sent by the client; returned on pull):

| Column       | Type   | Purpose |
|--------------|--------|---------|
| `user_id`    | uuid   | Owner scope. Always set from the auth token, never trusted from the client. |
| `server_seq` | bigint | Per-write monotonic sequence. The pull cursor basis. |

Client-only columns (local SQLite, **never synced**) — see §4.

---

## 2a. Multi-tenant isolation (invariant)

Isolation is the one property that must hold under "open to others later." State it once,
enforce it everywhere:

- **Every syncable table carries `user_id`**, always set server-side from the auth token —
  never read from the request body (§2).
- **Server primary key is composite `(user_id, id)`** — `id` is *client*-generated, so a
  plain `id` PK would make `INSERT … ON CONFLICT (id)` land one user's push on **another
  user's row** if ids ever collide (malicious reuse of a known uuid, or an actual
  collision). With `(user_id, id)` the same push harmlessly creates/updates a row in the
  pusher's own partition. The push upsert conflict target is `(user_id, id)` accordingly
  (§6). Client-side SQLite holds only this user's data, so `id` alone remains the local PK.
- **Every query is scoped**: pull filters `WHERE user_id = <token user>` (§5); push writes
  only rows whose `user_id` = token user; there is no endpoint that accepts a foreign
  `user_id`.
- **The advisory lock is per-user** (§3), so tenants never serialize each other — a busy
  user cannot stall another user's push.
- **Cursors are per-device state** (client-side `sync_meta`), inherently per-user.
- **No cross-user references exist in the data model** — album→asset and post→asset ids
  point only within the same user's partition.
- **S3 keys are namespaced per user** (shared bucket + per-user key prefix for new users;
  legacy per-user bucket for the existing account — see phase-1). The server always derives
  the bucket/prefix from the authenticated user and prepends the prefix to the
  client-supplied file key; presigned URLs are only ever generated inside the requester's
  namespace.

Per-user write volume and data size are unchanged from the single-user analysis (one
person's photo library metadata), so every "low volume" argument below reads **per user**.

---

## 3. Change tracking & cursor

The server stamps every insert/update/delete with a monotonically increasing
`server_seq` from a single global Postgres sequence:

```sql
CREATE SEQUENCE change_seq;
-- BEFORE INSERT OR UPDATE trigger on every syncable table:
NEW.server_seq := nextval('change_seq');
```

A **DB trigger** does this, so every collection gets cursoring automatically — no
per-collection code (supports the "easy to add collections" goal).

The client stores a single `cursor` = the highest **safe** `server_seq` it has pulled
(see the commit-visibility rule below). Pull is:

```sql
SELECT * FROM <table>
WHERE user_id = ? AND server_seq > :cursor
ORDER BY server_seq
```

Why a sequence, not a timestamp cursor: timestamps collide within a millisecond and
suffer clock skew. A monotonic integer avoids that. A global sequence shared by all users
is fine — since pull filters by `user_id`, each user's rows are still strictly increasing
(just non-contiguous, and increasingly sparse as other users write — which is harmless).

**Commit-visibility hazard (must handle).** `nextval('change_seq')` is assigned at
statement time, but a row becomes visible to a pull only at **commit** — and assignment
order ≠ commit order. If txn A takes seq 100 (uncommitted) while txn B takes 101 and
commits first, a pull can see 101, advance the cursor to 101, then **never** deliver row
100 once A commits. A naive `max(server_seq)` high-watermark silently drops changes under
concurrent writes (two devices pushing at once, or overlapping push transactions).

Chosen mitigation for this low-write-volume-per-user app: **serialize writes per user
with a Postgres advisory lock** (`pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`
— the lock takes a `bigint`, so hash the uuid) around each push transaction so, **within
each user's partition**, `server_seq` order == commit order, making the max *included* seq
a safe watermark. This argument is fully per-user: pull filters by `user_id`, the lock is
per-user, and other tenants' interleaved commits can neither hide nor reorder this user's
rows — so multi-tenancy neither weakens the watermark nor makes users contend (a user's
push only ever waits on that user's other devices). (Higher-
throughput alternative if ever needed: derive the watermark from transaction visibility via
`pg_snapshot_xmin(pg_current_snapshot())` rather than `max(seq)`.) The cursor is therefore
"safe," not merely "the max seq seen."

**Invariant: every write to a syncable table goes through the push path** (or, for rare
server-side maintenance scripts, manually takes the same advisory lock and writes via
UPDATE so the trigger stamps `server_seq`). A write that bypasses the lock re-opens the
commit-visibility hazard; a write that bypasses the trigger is invisible to pulls. Add this
to code review muscle memory alongside the no-hard-DELETE rule (§7).

> Storage engine decision (settled): **Postgres.** A single-writer server store (SQLite +
> Litestream) was considered — it would eliminate this hazard class — but it serializes
> *all* users behind one writer, which conflicts with the isolated-multi-tenant
> "open to others later" goal. Postgres with the per-user advisory lock gives the same
> safety per tenant while tenants stay independent.

---

## 4. Local-only vs synced fields

Be precise about what each flag means — getting this wrong breaks multi-device:

- `isFileSynced`, `isThumbnailSynced`, `isSynced` are **global facts** ("the binary/
  thumbnail exists in S3"), not per-device state. That is their meaning today: they travel
  in the JSON blob, and the uploading device **deletes its local copy of the file after
  upload** (`CloudSyncProvider` → `deleteAssetFileAsync`). If these were made local-only
  and defaulted to `false`, a second device pulling metadata would queue *every* asset for
  upload (`getUnsyncedAssets` filters on `!isSynced`) and fail on all of them, because the
  files no longer exist locally anywhere. **So these three flags are synced fields.**
  The known cost: they ride whole-record LWW, so a concurrent offline metadata edit on
  another device can briefly revert a freshly-set flag — that only re-queues an idempotent
  upload to the same S3 key, which is wasteful but self-healing (and the upload path must
  in any case skip queued assets whose local file is absent).
- `syncError` — this device's last upload error — **is** per-device and stays local-only.
- Local *cache* presence ("do I have the file on this device") is not a flag at all today;
  it is inferred from the filesystem. Keep it that way.

Local-only fields live only in local SQLite and are excluded from pull/push payloads. A new
device pulls asset **metadata** (including the true `isFileSynced` state), then lazily
downloads the actual files via the existing presigned-URL flow.

The collection descriptor marks which fields are `localOnly`.

---

## 5. Pull protocol

> Endpoint paths in §5–§6 omit the `/api/v1` prefix the server mounts them under
> (i.e. `/api/v1/sync/pull`, `/api/v1/sync/push`).

`POST /sync/pull`

Request:
```jsonc
{ "cursor": 0, "limit": 500 }   // cursor 0 = first/full sync
```

Response:
```jsonc
{
  "changes": {
    "assets": { "records": [ { /* full row incl deletedAt */ } ] },
    "albums": { "records": [ /* … */ ] },
    "posts":  { "records": [ /* … */ ] }
  },
  "cursor": 1234,        // new high-water mark (max server_seq returned)
  "hasMore": false       // true if limit was hit; client loops until false
}
```

Server: for each registered collection, select **up to `limit`** rows with
`server_seq > cursor` ordered by `server_seq`; global-merge the per-collection lists by
`server_seq`, cut at `limit`, and set the response `cursor` = the `server_seq` of the last
**included** row (not `max` across all collections). Fetching `limit` from *each*
collection before the cut guarantees no row is skipped when a page truncates. Clamp the
client-supplied `limit` server-side. The single global sequence makes seqs unique across
collections, so there are no cross-collection ties. Tombstones (rows with `deleted_at`)
flow through like any change.

Client apply (**server-authoritative, guarded by the outbox — not a timestamp
comparison**): apply the incoming row **iff the record has no pending outbox mutation**;
skip it if one exists (the pending push will re-assert the local edit, and the push
response arbitrates — see the `skipped-lww` `current` mechanism in §6). If `deleted_at` is
set, tombstone locally under the same rule. Apply each pull page **in a single SQLite
transaction**, then persist the new `cursor` in the same transaction.

Do **not** compare `incoming.updated_at` against the *committed* local row. That
comparison is subtly wrong: the server clamps future timestamps (§7), so a device with a
fast clock would hold a local `updated_at` higher than anything the server ever returns —
including the clamped echo of its own write — and would then refuse every later legitimate
edit from other devices, diverging permanently. The outbox is the sole marker of "local
state the server hasn't seen"; committed local state is by construction never newer than
what pull returns.

(One benign race to know about: a pull that was already in flight when a push landed can
deliver a pre-push snapshot and briefly revert the pushed edit locally; the next pull
re-delivers the correct row since its `server_seq` is above that response's cursor.
Serializing the sync worker — one run at a time, push then pull, §8 — makes this window
irrelevant in practice.)

**Tombstone retention:** keep tombstoned rows indefinitely (per-user data volume is tiny —
metadata rows for one person's library; this stays true per tenant no matter how many
tenants exist) so late-syncing devices learn of deletes. If a cursor is ever too old to
trust, fall back to a full resync (`cursor = 0`). Revisit only if some future tenant's
tombstone count measurably hurts their own full-resync time — retention policy would then
be per-user data, not a protocol change.

---

## 6. Push protocol

`POST /sync/push`

Request — each mutation is a **whole-record upsert** of synced fields (not field-level
deltas):
```jsonc
{
  "mutations": [
    { "collection": "assets", "record": { "id": "…", "updatedAt": 1699, "deletedAt": null, /* …fields… */ } },
    { "collection": "albums", "record": { "id": "…", "updatedAt": 1700, "deletedAt": 1700, /* delete */ } }
  ]
}
```

Server, in one transaction (take `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`
first, per §3):
1. For each mutation, validate `record` against the collection's Zod schema.
2. Apply LWW as a **single atomic statement** (no select-then-write TOCTOU race):
   `INSERT … ON CONFLICT (user_id, id) DO UPDATE SET … WHERE excluded.updated_at > <table>.updated_at`.
   The conflict target is the **composite PK `(user_id, id)`** (§2a) — conflicting on `id`
   alone would let a colliding uuid update another user's row. Use strict `>`: because the
   §3 trigger re-stamps `server_seq` on *every* UPDATE, an equal-timestamp replay must
   **not** satisfy the WHERE — with `>` it doesn't, so the replay is a true no-op (no
   re-stamp, no sync amplification). Trade-off: two genuinely distinct edits sharing the
   same millisecond resolve to the first applied; the later is dropped (and the loser
   learns via `skipped-lww` + `current`, below). Same-device collisions — the common way to
   hit this — are eliminated by the client's per-record monotonic `updated_at` rule
   (below); cross-device same-ms collisions remain vanishingly rare within one user's
   device set (users never conflict with each other, §2a). Always set `user_id` from the
   token; ignore any client-provided owner.
3. Record each mutation's outcome: `applied` | `skipped-lww` (+ the winning `current`
   record, see below) | `rejected` (+reason).

Response — a **per-mutation result array**, so the client knows exactly what landed:
```jsonc
{
  "results": [
    { "id": "…", "status": "applied" },
    { "id": "…", "status": "skipped-lww", "current": { /* the server's winning record */ } },
    { "id": "…", "status": "rejected", "reason": "schema:…" }
  ]
}
```

`skipped-lww` **must include the server's current record** (`current`). This is not a
nicety — without it the losing device can diverge permanently: the winning row's
`server_seq` was typically already delivered by an earlier pull and *skipped* on apply
(because this record then had a pending outbox mutation, §5), and a pull from the stored
cursor will **not** re-deliver it. On `skipped-lww` the client clears the outbox row and
overwrites the local record with `current` — unless the user has since made an even newer
pending mutation for that record, in which case leave it and let the next push arbitrate.

The client clears `applied` rows, handles `skipped-lww` as above, and **keeps + flags**
`rejected` ones — never a blanket "clear all on HTTP 200," which silently loses a rejected
edit. It then runs a **pull** from its stored cursor.

**Per-record monotonic `updated_at` (client rule).** When writing locally, set
`updated_at = max(Date.now(), previous.updated_at + 1)`. Without this, two edits to the
same record within one millisecond on the *same* device produce equal timestamps, and the
strict-`>` LWW silently drops the second on push (easy to hit with programmatic bulk
updates, not just fast taps). The bump also keeps a slightly-behind clock from losing to
this device's own earlier writes. Optionally, **coalesce the outbox** to one pending row
per record (latest whole-record payload wins) — pushes shrink and per-record "pending"
state stays trivially queryable.

Do **not** return a cursor from push for the client to adopt — because of the
commit-visibility rule (§3), the client must advance its cursor only via pull.

**Idempotency:** atomic upsert keyed by `(user_id, id)` with strict `>` LWW is safe to
replay — an equal/older `updated_at` is a genuine no-op (no `server_seq` bump). Retries
need no dedup.

---

## 7. Conflict resolution

- **Granularity:** whole-record last-write-wins by `updated_at`. Simpler than per-field,
  acceptable because conflicts only arise between one person's own devices (§2a) — this
  holds at any tenant count, since tenants never touch each other's rows. (Per-field merge
  is a future upgrade if needed.)
- **Deletes:** a delete is just an update that sets `deleted_at`. Delete-vs-edit is
  resolved by the same LWW: a newer edit beats an older delete (undelete), and vice versa.
- **Ordered relations** (`album.assets`, `post.assetRefs`): stored as JSON columns, so they
  move atomically with the record under LWW. The known cost: reordering an album on one
  device while adding to it on another *offline* → one wholesale wins. Rare for one
  person's own devices;
  the fix (join tables + fractional-index positions) is a localized future upgrade because
  sync is collection-generic.
- **Clock skew:** the client sets `updated_at`. The server **clamps** any `updated_at` in
  the *future* to server-now. Clamping means the stored value can differ from the sender's
  local copy — harmless *only because* the client apply rule (§5) is outbox-guarded rather
  than timestamp-compared: the clamped echo comes back on the next pull and is adopted.
  Remaining asymmetry: a device whose clock is *behind* writes legitimately-new edits with
  a small `updated_at` that can lose push-side LWW until it catches up (the per-record
  monotonic bump in §6 covers the common same-device case) — an accepted limitation, since
  a skewed clock can only hurt that user's own convergence, never another tenant's.
  (Future hardening: a server receipt timestamp as tiebreaker, or reject writes skewed
  beyond a bound.)
- **No hard deletes (invariant):** every delete is an UPDATE that sets `deleted_at`, so the
  trigger stamps a new `server_seq` and the tombstone propagates. A real SQL `DELETE` gets
  no `server_seq` and is invisible to other devices — forbid it (no DELETE grant / enforce
  by convention + review). Note the current app *does* hard-delete
  (`deleteAssetsAsync` removes the record from state); on the new path that operation
  becomes "set `deleted_at`" at the repository boundary.

---

## 7a. Binary files and tombstones

Metadata sync doesn't move binaries, but deletes couple the two — spell it out:

- **S3 deletion stays the deleting device's job**, synchronous with the delete action,
  exactly as today (`deleteAssetFilesAsync` before tombstoning the record). If the S3
  delete fails (offline), surface the error as today and let the user retry; the tombstone
  still syncs. Worst case is an orphaned S3 object — storage waste, not corruption. A
  server-side GC that removes S3 objects for tombstoned assets is an optional future
  cleanup; never required for correctness.
- **Applying an asset tombstone from pull** must also delete this device's local file and
  thumbnail copies (the per-device analog of what the deleting device did locally).
- **The upload queue must skip assets whose local file is missing** (regardless of flags,
  §4) — a queued upload for a file this device doesn't have can only fail.

---

## 8. Client architecture

Local store: **expo-sqlite + Drizzle** (first-party module — zero eject/plugin risk).

Tables:
- One table per collection (synced fields + local-only fields).
- `sync_meta(key, value)` — holds the `cursor`.
- `outbox(id, collection, record_id, op, payload_json, updated_at, created_at)` — the
  mutation queue (optionally coalesced to one row per record, §6).

**Reactivity: keep the provider model, SQLite underneath.** The whole app already consumes
each collection as an in-memory map from a context provider (`useAssets()` etc. — dozens
of consumers, plus cross-collection selectors like `getUnsyncedAssets` that operate on
in-memory arrays). Rewiring every consumer to per-screen Drizzle `useLiveQuery` would be a
second, app-wide refactor stacked on top of the sync migration. So the default here is the
smaller change: **keep the providers' public API (in-memory map + methods) and make SQLite
the durable system of record beneath them** — structurally the same memory+persistence
split the app has today with JSON files, just with SQLite + an outbox instead of a blob.

- **Hydrate:** on flag-on start, load the collection tables into the providers' maps
  (replaces `readLocalDataAsync`). This is what the app already does with JSON; the data
  fits in memory today and will tomorrow.
- **Write path** (a local edit): one repository function per collection does — in a single
  SQLite transaction — (1) upsert the row with the monotonic `updated_at` (§6), (2)
  enqueue/coalesce the outbox row; then (3) update the in-memory map (UI re-renders as
  today), and (4) kick the sync worker (debounced). All provider methods route through it,
  so memory and SQLite cannot drift.
- **Pull apply:** the worker applies a page transactionally to SQLite (§5), then pushes the
  same changes into the in-memory maps — that is the "edit it here, it updates there" feel.

`useLiveQuery` remains available as an *incremental* upgrade for individual screens (and
for the Sync Inspector, where querying SQLite directly is natural). If/when it is used:
the DB must be opened with `openDatabaseSync(name, { enableChangeListener: true })` —
`useLiveQuery` does **not** react to writes without this flag (a silent "why isn't the UI
updating" trap) — and pull pages must stay batched in transactions so a 500-row apply
doesn't trigger 500 re-queries.

**Sync worker** (drain + reconcile — **single-flight**: one run at a time, push then pull,
never two concurrent runs; cf. the in-flight-pull race in §5):
1. `POST /sync/push` with pending outbox mutations → clear `applied`; apply `current` +
   clear for `skipped-lww`; keep + flag `rejected` (§6).
2. `POST /sync/pull` from the stored cursor → apply changes (outbox-guarded, §5) →
   advance cursor.

**Triggers for the worker (primary path = foreground + on-mutation):**
- After each mutation (debounced) — the main way changes propagate.
- On app foreground, and on a plain in-app interval while foregrounded (`AppState` +
  `setInterval` — ordinary JS, *not* `expo-background-task`).
- Opportunistically in the background via `expo-background-task` + `expo-task-manager`. On
  iOS this is `BGTaskScheduler`: **~15 min minimum, frequently deferred by the OS, and it
  does not run on the simulator** — a best-effort top-up, never the primary channel.
- *Optional later:* an APNs silent push from the backend on write → near-instant pull.
  Deferred; requires the backend to send pushes.

**Initial sync / new device:** `cursor = 0` → paginated full pull. Files download lazily.

---

## 9. Collection descriptor (the generic abstraction)

Defined once in `packages/shared`, the single source of truth:

```ts
// packages/shared/collections/asset.ts
export const assetCollection = defineCollection({
  name: 'assets',
  schema: z.object({                 // synced fields (incl. base columns)
    id: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.number().nullable(),
    mediaLibraryAssetId: z.string(),
    mediaType: z.enum(['photo', 'video']),
    width: z.number(),
    height: z.number(),
    fileSize: z.number(),
    duration: z.number().nullable(),
    filename: z.string(),
    thumbnailFilename: z.string(),
    isFavorite: z.boolean(),
    notes: z.string().nullable(),
    postHistory: z.array(z.string()),
    lastPostedAt: z.number().nullable(),
    oldFileId: z.string().nullable(),
    isFileSynced: z.boolean(),        // global "binary is in S3" facts — synced (§4)
    isThumbnailSynced: z.boolean(),
    isSynced: z.boolean(),
  }),
  localOnly: {                        // client-only, never synced
    syncError: z.string().nullable(), // this device's last upload error (§4)
  },
});
```

The descriptor drives: Zod validation on push, inferred TS types on both sides, and the
registry the pull/push endpoints iterate. The Postgres and SQLite Drizzle tables are
declared per-dialect but derived from the same field list (a thin manual mapping — not
worth auto-generating).

### Recipe to add a collection later
1. Add a descriptor (name + Zod schema + `localOnly`) in `packages/shared`.
2. Register it in the collection registry.
3. Generate a Postgres migration — **including attaching the `BEFORE INSERT OR UPDATE`
   `server_seq` trigger to the new table** (without it, rows get a null `server_seq` and are
   never pulled) — and a SQLite migration (Drizzle Kit).

Everything else — cursoring (trigger), pull/push, outbox, apply, reactivity, conflict
handling — works unchanged. The two migrations are the only irreducible per-collection
cost.

**Guard rail:** the forgotten trigger is the recipe's one silent failure mode (rows sync
*to* the server but never *from* it). Add a registry-driven backend test that iterates
every registered collection and asserts (a) its Postgres table exists, (b) the
`server_seq` trigger is attached (query `pg_trigger`), (c) the primary key is the
composite `(user_id, id)` (§2a — a plain-`id` PK on a new table silently re-opens the
cross-tenant collision hole), and (d) a round-trip insert-then-pull returns the row and a
second user's pull does **not**. New collections are then covered automatically.

---

## 10. The three initial collections

Mapped from the current yup schemas. `isDeleted: true` → `deletedAt = updatedAt`;
`createdAt`/`updatedAt` are already epoch numbers.

**assets** — synced: `mediaLibraryAssetId, mediaType, width, height, fileSize, duration,
filename, thumbnailFilename, isFavorite, notes, postHistory, lastPostedAt, oldFileId,
isFileSynced, isThumbnailSynced, isSynced, createdAt, updatedAt, deletedAt` (the three
`is*Synced` flags are global "binary exists in S3" facts — see §4). local-only:
`syncError`.

**albums** — synced: `name, assets` (JSON array of asset ids, ordered), `isFavorite,
archivedAt, postHistory, lastPostedAt, showInPostSuggestionsAfter, oldCollectionName,
notes, sortOrder` (null|'custom'), `smartAlbumType, createdAt, updatedAt, deletedAt`.
local-only: none.

**posts** — synced: `text, assetRefs` (JSON array of `{id, assetId}`), `isFavorite,
postedAt, rePostId, isIgnoredForRepost, suggestRepostAt, hasBeenReposted, createdAt,
updatedAt, deletedAt`. local-only: none.

Cross-collection references (album→asset ids, post→asset ids) are **not** FK-enforced in
sync; the UI already tolerates dangling ids (they are plain string arrays).

---

## 11. One-shot data converter (client button)

The app already downloads the old JSON files (`assets.json`, `albums.json`, `posts.json`)
locally; each is a map `{ [id]: entity }`. The converter, behind a dev toggle:

1. Read the three local JSON maps.
2. For each entity, map old fields → new record (`isDeleted` → `deletedAt`; the
   `is*Synced` flags carry over as synced fields per §4 — do **not** reset them; only
   `syncError` resets as local-only).
3. Insert into local SQLite + enqueue outbox.
4. Normal push uploads metadata to the new backend. Asset **files** stay in S3 under their
   existing `filename` keys — untouched.

Throwaway code: hardcode your data's assumptions, no validation polish, delete after one
run.

---

## 12. Open decisions (recommended defaults)

| Decision | Recommendation |
|----------|----------------|
| Push shape: whole-record vs field-level deltas | **Whole-record** (simpler, idempotent). |
| Tombstone retention | **Keep indefinitely**; full-resync fallback if cursor too old. |
| Cross-device push latency | **Foreground + on-mutation (debounced)** as the primary path; background is opportunistic (iOS `BGTaskScheduler` ~15 min, OS-throttled, no simulator); APNs push later. |
| Cursor mechanism | **Global `change_seq` sequence** stamped by a trigger. |
| Conflict granularity | **Whole-record LWW**; per-field / join-table ordering as future upgrades. |
| Client apply rule | **Outbox-guarded, server-authoritative** (§5) — never timestamp-compare against committed local state. |
| `skipped-lww` handling | Push response **returns the winning record** (`current`); client adopts it (§6). |
| Client reactivity | **Keep provider in-memory maps, SQLite as system of record** (§8); `useLiveQuery` per-screen later. |
| Asset file flags | **Synced** (global S3 facts); only `syncError` is local-only (§4). |
| Tenancy | **Isolated multi-tenant** (§2a): composite `(user_id, id)` PK, per-user advisory lock, all queries token-scoped, per-user S3 namespace. No cross-user sharing — ever adding it is a redesign trigger (see build-vs-adopt note). |

---

## 13. Observability & the Sync Inspector

Today you can open the JSON files to see all data and its sync state. After moving to
local SQLite that affordance is gone, so the engine must **expose** equivalent (richer)
introspection, and the app renders it in a **Sync Inspector** dev screen. The engine part
is designed in here; the screen is app work (Phase 3a — deliberately right after the first
collection works, so the tool exists before the scale-out it debugs). All of this is
local-only — none of
it syncs.

### Engine-exposed state (build the engine to surface these)

- **Sync status** — in `sync_meta`, observable via `useLiveQuery`:
  `{ phase: 'idle' | 'pushing' | 'pulling' | 'error', lastPushAt, lastPullAt, lastError, cursor }`.
- **Outbox is queryable** — overall and per-collection pending counts, and each pending
  mutation (`collection, record_id, op, updated_at, attempts, lastError`).
- **Per-record dirty state** — a record is "pending" if it has an outbox row. Surface this
  (via a join, or a `dirty` boolean column the worker maintains) so lists can show a
  per-item "not yet synced" badge — the record-level analog of the old per-file flags.
- **Binary file state** — keep surfacing the per-asset file flags (`isFileSynced`,
  `isThumbnailSynced` — synced global facts per §4) plus this device's local-only
  `syncError`, so you can see which files/thumbnails are in the cloud and what failed here.
- **Sync log** — a small ring-buffer table `sync_log(ranAt, pushed, pulled, durationMs,
  error, notes)` holding the last ~K runs. **Conflict/rebase visibility** lives here: when a
  local change loses LWW (a `skipped-lww` push result whose `current` record replaces the
  local edit, §6), the worker writes a note (e.g. "album <id>: local change overwritten by
  server"), so an override is never silent.

### App-side Sync Inspector (dev/settings screen, Phase 3a)

- **Header:** status (idle/syncing/error), last sync time, cursor, total pending count.
  Actions: **Sync now**, **Full resync**, **Clear outbox** (dev-only). Define **Full
  resync = wipe local collection tables + repull from `cursor = 0`** — merely resetting
  the cursor without wiping leaves local orphans (e.g. records created locally whose
  outbox rows were cleared) that pull can never remove. Warn before wiping if the outbox
  is non-empty (pending edits would be lost), and note **Clear outbox** can strand
  never-pushed local records until the next full resync.
- **Per collection:** record count, pending count, tombstone count; tap to **browse raw
  records** with search — the direct replacement for "opening the JSON file".
- **Outbox:** list of pending mutations with op, age, attempts, and any error.
- **Log:** recent sync runs, errors, and conflict/rebase notices.
- **Files:** per-asset file/thumbnail upload state from the local-only flags.

### Backend observability
The Inspector is client-side; the backend needs its own minimal logging so issues are
diagnosable server-side: structured logs on push/pull (**tagged with `user_id`** — with
multiple tenants, untagged logs are undebuggable), mutation counts, `applied` vs
`skipped-lww` vs `rejected`, the safe-watermark value, S3 upload/abort outcomes, and the
`/up` health check.

### Design impact
Small and additive: one `sync_log` table, the `sync_status` fields in `sync_meta`, and an
optional per-row `dirty` column. No change to the pull/push protocol.
</content>
</invoke>
