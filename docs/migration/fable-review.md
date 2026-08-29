# Independent architecture review (Fable)

Reviewed: `docs/sync-design.md`, `docs/migration/README.md`, `phase-0` … `phase-5`.
Grounded against the actual app source (`src/features/*`, `src/utils/cloud-api/*`,
the yup schemas in `src/utils/`, `CloudSyncProvider.js`, `uploadFileAsync.js`) and the Rails
backend (`authentication_controller.rb`, `data_controller.rb`, `asset_files_controller.rb`,
`lib/storage.rb`). Nothing was treated as settled, including decisions marked as already
reviewed.

**Bottom line:** the overall shape of the plan is sound and unusually well-researched
(the Expo/monorepo hoisting traps, the commit-visibility hazard, and the OTA/native-module
rule are all real and correctly handled). But the sync protocol as written had **two
genuine convergence bugs** and the data model had **one multi-device breakage** — all three
would have shipped, worked in single-device testing, and silently diverged data across
devices later. I fixed those in the docs, plus several smaller gaps. I endorse the
foundational decisions (build-your-own sync, Fastify/Drizzle/Postgres, monorepo, phasing)
with reasoning below, and leave three decisions to the user.

---

## 1. Issues found and FIXED in the docs (ranked by severity)

### 1.1 CRITICAL — `skipped-lww` caused permanent divergence (sync-design §5/§6)

The original protocol: on push, a mutation that loses LWW returns `skipped-lww`; the
client clears it from the outbox and "runs a pull … to learn authoritative state."

That pull **cannot** deliver the winning record in the common case. The winning row's
`server_seq` was typically already delivered by an *earlier* pull — and skipped on apply,
because the record then had a pending outbox mutation. Pull is cursor-based; it never
re-delivers a seq the cursor has passed. Result: the losing device clears its outbox row,
keeps its losing local value forever, and the two devices disagree until some unrelated
edit re-stamps the record. This is a silent, permanent split-brain on exactly the flow LWW
is supposed to resolve.

**Fix (edited §6, §8; phase-2 steps 4/5/10 + checklist):** the push response's
`skipped-lww` result now **must include the server's current record** (`current`); the
client adopts it (unless a newer pending mutation for that record exists, in which case
the next push arbitrates). Added a two-device convergence test to the Phase 2 checklist.

### 1.2 CRITICAL — client apply rule diverged under the server's timestamp clamp (§5)

The original client apply rule: apply an incoming row only when
`incoming.updated_at >= local.updated_at` (plus an outbox check). Combined with §7's
server-side clamp of future timestamps, this is wrong: a device with a fast clock writes
`updated_at = now + skew`; the server stores the clamped (lower) value; the device's local
copy keeps the high value. From then on that device rejects **every** pulled row for that
record — including legitimate newer edits from other devices and the clamped echo of its
own write — because `incoming < local`. Permanent one-device divergence, invisible until
you compare devices.

**Fix (rewrote the §5 apply rule; propagated to §7 and phase-2 step 10):** pull-apply is
now **server-authoritative, guarded only by the outbox**: apply iff the record has no
pending outbox mutation; never timestamp-compare against committed local state. Committed
local state is by construction never newer than what pull returns (any unpushed newness
lives in the outbox), so the timestamp comparison was not just unsafe — it was
unnecessary. Also documented the benign in-flight-pull race and made the sync worker
explicitly single-flight (§8).

### 1.3 CRITICAL — `isFileSynced` flags as "local-only" broke multi-device (§4, §10, §11)

The design classified `isFileSynced`/`isThumbnailSynced`/`isSynced` as per-device
local-only fields. In the actual app these are **global** facts ("the binary is in S3"):
they travel in the JSON blob today, and — decisive detail — `CloudSyncProvider.syncAssets`
**deletes the local file after upload** (`deleteAssetFileAsync(asset.filename)`). Under
the proposed design, a second device pulls metadata, gets default `isSynced = false` for
everything, `getUnsyncedAssets` (filters `!isSynced`) queues **every asset for upload**,
and every upload fails because no device still has the files locally. The design's own
one-liner ("a new device … maintain[s] its own copy of these flags") doesn't survive
contact with the code.

**Fix (rewrote §4; updated §9 descriptor example, §10, §11, §13, phase-4 converter +
checklist):** the three flags are **synced fields**; only `syncError` stays local-only.
Noted the accepted cost (a concurrent whole-record LWW loss can transiently revert a flag
→ one redundant idempotent re-upload) and the required guard (upload queue skips assets
whose local file is absent).

### 1.4 HIGH — same-millisecond same-device edits silently dropped (§6)

Strict-`>` LWW plus client-set epoch-ms `updated_at` means two edits to the same record in
the same millisecond on the *same* device push equal timestamps, and the second is
silently discarded server-side. Not "vanishingly rare": programmatic bulk updates
(`updateManyAssets`, favorite-then-edit flows) can easily produce this. **Fix:** client
rule `updated_at = max(Date.now(), prev.updated_at + 1)` (per-record monotonic), added to
§6/§8 and phase-2 step 10; outbox coalescing (one pending row per record) added as a
recommended simplification.

### 1.5 HIGH — single-slot refresh token defeats transparent multi-device sync (phase-1)

Phase 1 instructed replicating Rails' refresh storage "exactly": one `refresh_token`
column per user, overwritten on every rotation (`authentication_controller.rb`
`generate_refresh_token`). With two devices, whichever refreshes first invalidates the
other's refresh token; the other device silently lands back at the login screen and its
background sync stops. Tolerable for manual backup/restore; directly hostile to the
product goal this whole migration exists for. **Fix:** phase-1 now specifies a per-device
`refresh_tokens` table as a **deliberate, clearly-marked deviation** — the wire contract
(request/response shapes) is unchanged, so the client needs no modification and "parity"
is preserved where it matters. Added a two-device-token checklist item.

### 1.6 HIGH — no backup story for the new Postgres (README, phase-5)

The fix-forward posture leaned entirely on retaining the *old* blobs — which are frozen at
cutover and deleted-ish after 5b. Post-cutover, the new Postgres is the only live metadata
source, and the plan said nothing about backing it up; today's versioned `data_backups` +
S3 blob snapshots disappear with Rails. Fix-forward is impossible if the data itself is
gone (bad migration, converter accident, fat-fingered SQL) — that's data loss, not
rollback, so it's compatible with the user's no-rollback constraint. **Fix:** automated
Postgres backups (restore-verified) added as a hard Phase 5a prerequisite and a README
convention.

### 1.7 MEDIUM — binary file lifecycle vs tombstones was unspecified (new §7a)

The design synced metadata deletes (tombstones) but never said who deletes the S3 object,
what other devices do with their local file copies on tombstone-apply, or what happens
when the deleting device is offline. **Fix:** new §7a — S3 delete stays the deleting
device's synchronous job (as today), tombstone-apply removes local file/thumbnail copies,
failed S3 deletes degrade to orphaned objects (storage waste, never corruption), optional
server-side GC later. Added a phase-3 checklist item.

### 1.8 MEDIUM — the `useLiveQuery`-everywhere reactivity swap understated the app rewrite (§8, phase-2b)

The app's entire UI consumes collections as in-memory maps from context providers
(`useAssets()` et al.), with cross-collection selectors over in-memory arrays. The plan's
flag-on path ("SQLite-backed repository + `useLiveQuery`") quietly implies migrating every
consumer to a per-screen query model — a second app-wide refactor stacked on the sync
migration, and the main threat to the "every phase ships" claim. **Fix (rewrote §8;
phase-2 steps 6/11):** default is now to **keep the providers' in-memory-map API** and
make SQLite the durable system of record + outbox beneath them (structurally identical to
today's memory + JSON-file split), with a single transactional repository write path so
memory and SQLite can't drift. `useLiveQuery` is repositioned as an optional per-screen
upgrade (natural fit: the Sync Inspector), with the `enableChangeListener` and
batch-transactions caveats retained.

### 1.9 MEDIUM — smaller correctness/ops gaps (all fixed)

- **Server write invariant (§3):** all writes to syncable tables must go through the push
  path (or take the same advisory lock + write via UPDATE); a bypassing script re-opens
  the watermark hazard or is invisible to pulls.
- **Forgotten-trigger guard (§9, phase-3):** a registry-driven test asserting every
  registered collection's table has the `server_seq` trigger and round-trips through pull
  — the one silent failure mode of the "add a collection" recipe.
- **Full resync defined as wipe + repull (§13, phase-3):** resetting only the cursor
  can't remove local orphans (e.g. after dev "Clear outbox"); warn when the outbox is
  non-empty.
- **Converter: one device only (phase-4):** run the converter on exactly one device;
  others populate via full pull — a second device's older JSON pushed through LWW is
  thrash at best, stale-wins at worst. Also: `is*Synced` flags carry over (per 1.3).
- **`.easignore` replaces `.gitignore` for EAS uploads (phase-0):** it must re-list the
  gitignored secrets/dirs or they ship in the build context.
- **Token-in-URL log hygiene (phase-1):** the client legitimately sends `?token=<JWT>` on
  uploads (verified in `uploadFileAsync.js` — iOS background-upload header limitation), so
  the new server must redact query strings in request logs. (I initially challenged the
  lenient-auth parity as a wart; the code shows it's load-bearing, so it stays.)

---

## 2. Foundational decisions I challenged and ENDORSE (unchanged)

> Sections 1–4 were written under the original single-user assumption. The 2026-08-29
> switch to isolated multi-tenant is handled in **§5**, which re-validates each
> endorsement below under the new assumption (they all hold — the conflict analysis is
> per-user) and records one new critical fix (composite PK).

- **Hand-rolled sync vs WatermelonDB / PowerSync / ElectricSQL / Replicache-Zero /
  Turso.** I take the "never hand-roll sync" folklore seriously; it doesn't apply here.
  Every candidate either still requires writing the server write path (WatermelonDB,
  Replicache, Electric — whose sync is read-path only) or inserts a third-party sync
  service between app and Postgres (PowerSync, Electric, Zero) — an opaque moving part
  that fights the user's "inspect my sync state" and "simple to operate" constraints, with
  mixed Expo/New-Arch maturity. The protocol here is small (single user, full replication,
  whole-record LWW), and the genuinely tricky parts (commit visibility, idempotent push)
  are identified and now correct. Owning the engine is what makes the Sync Inspector
  possible. Added a short build-vs-adopt paragraph to the design intro with
  reconsider-triggers: multi-user, partial replication, per-field merge.
- **Global sequence + advisory-lock watermark (§3).** Correct as specified, and the doc's
  treatment of the commit-visibility hazard is better than most production systems'.
  Endorsed, with the new "all writes through the push path" invariant.
- **Whole-record LWW + JSON-array ordered lists (§7).** Right call at single-user scale;
  the lost-update window requires the same person editing the same record on two devices
  within the offline window, and the sync-log conflict notes make losses visible rather
  than silent. Fractional-index join tables would triple the schema for a conflict class
  the user may never hit. Keep; upgrade later if the sync log shows real losses.
- **Fastify + Drizzle + Postgres + shared Zod.** Reasonable, boring, well-supported; Zod
  descriptors as the single contract is the strongest part of the design. (One watch item:
  `fastify-type-provider-zod` version pinning vs Fastify/Zod majors — minor.)
- **Monorepo (npm workspaces) + Phase 0 as one atomic PR.** The phase-0 doc preempts the
  three real hoisting breakages (AppEntry path, babel alias cwd, ngrok binary path) and the
  Metro/EAS specifics check out against the actual configs. Endorsed.
- **Phasing + "every phase ships".** The 2a/2b split, the strict flag-boundary rule, the
  native-module/OTA `runtimeVersion` rule, and the fix-forward framing are all sound. With
  1.8's provider-preserving client architecture, the "every phase ships" claim is
  believable; with the original `useLiveQuery` rewrite it was not.
- **Phase 1 byte-parity with Rails.** I probed whether this is gold-plating; it isn't —
  flag-on routing sends *all* traffic (including file uploads) to the new backend in
  Phases 2–4, so auth + asset parity is genuinely needed by 2b, and exact parity is what
  keeps the client untouched. The quirky details (binary-MiB multipart threshold, `error`
  vs `errors` shapes, lenient token extraction) are all verified real in the Rails source.

---

## 3. Decisions for the USER (not changed; flagged in docs where noted)

1. **Postgres vs server-side SQLite (+ Litestream).** ~~A single-writer server store would
   eliminate the commit-visibility hazard class and shrink ops~~ — **RESOLVED: Postgres**
   (user decision, 2026-08-29). Under the new isolated-multi-tenant requirement (§5 below)
   the SQLite option is no longer attractive anyway: a single writer serializes *all*
   tenants, whereas Postgres + the per-user advisory lock keeps tenants independent. The
   §3 note in sync-design now records this as settled.
2. **Fix-forward with no rollback.** Kept, per your explicit constraint, and it's coherent
   for a solo project. My concern is narrower: fix-forward assumes the *data* survives
   your mistakes. That's why restore-verified Postgres backups are now a 5a prerequisite —
   please don't treat that as optional; it is the difference between "annoying evening"
   and "photos metadata gone." (Clearly-marked note in README + phase-5.)
3. **When to add APNs silent push.** The design correctly makes foreground + on-mutation
   the primary channel and iOS background best-effort. Expect device-B updates to land on
   next app-open, not within seconds while backgrounded — if that materially disappoints
   the Apple-Photos expectation, the APNs path (deferred in §8) moves from "later" to
   "soon." No doc change needed; calibrating expectations.

## 4. Open questions

- **Auth token migration at cutover:** sharing Rails `secret_key_base` as the HS256 secret
  keeps existing *access* tokens valid, but with the per-device refresh-token table (1.5)
  old refresh tokens won't exist in the new DB — decide between a one-time forced re-login
  at cutover (simplest; recommended) or importing the current token row.
- **`suggestRepostAt` default** (`postSchema.js` defaults it to `createdAt`) — sync-design
  §10 lists it nullable-less; make the Zod descriptor match the real data (non-null number)
  during Phase 3, and generally diff each descriptor against a real JSON export before
  freezing it.
- **Sharing `secret_key_base` long-term:** fine for the transition; consider rotating to a
  dedicated JWT secret in 5b (forces one re-login, removes the last Rails coupling).

---

## 5. Addendum — isolated multi-tenant revision (2026-08-29)

The foundational assumption changed from "single user, multiple devices" to **isolated
multi-tenant**: many users, each with fully private data synced across their own devices
only; no sharing or co-editing between users; "just me now, open later"; hardening
(email verification, abuse) deferred. Storage engine confirmed as Postgres; new-Postgres
backups stay a 5a prerequisite; APNs stays deferred. This section records what that
changed.

### 5.1 NEW CRITICAL issue found — cross-tenant row collision on push (fixed)

The push upsert was `INSERT … ON CONFLICT (id) …` with a **client-generated** `id` as the
sole primary key. With more than one user, any client that pushes a record whose uuid
matches another user's row hits that row's conflict path — the LWW `WHERE` and the
"set `user_id` from token" step then fight over *someone else's record*. That's a
cross-tenant integrity hole reachable by malice (replaying a known/guessed uuid) or by
plain uuid collision. Single-user, it was unobservable; multi-tenant, it's the whole
ballgame. **Fix:** server PK is now composite **`(user_id, id)`** and the upsert conflicts
on `(user_id, id)` — a colliding push lands harmlessly in the pusher's own partition.
Client-side SQLite keeps `id` alone (it only ever holds one user's data). Edited:
sync-design §2, new §2a, §6, §9 guard-rail test; phase-2 steps 1/4/5; phase-3 registry
test. Isolation tests (user B never sees or touches user A's rows; id-collision push
stays in B's partition) are now mandatory in phases 2 and 3.

### 5.2 What multi-tenancy did NOT change — confirming the §2 endorsements

I re-derived, rather than assumed, that the single-user-justified decisions survive:

- **Whole-record LWW (and the JSON-array ordered lists, delete-vs-edit, clock-skew
  handling): still correct.** Every conflict argument in the design is about concurrent
  writers *to the same rows*. Under isolated multi-tenancy the writer set for any row is
  still exactly one person's devices — tenants never write each other's rows (§2a + the
  composite PK). So the conflict analysis is per-user and identical to before; user count
  multiplies partitions, not conflicts. Endorsement stands.
- **Global `change_seq` + per-user advisory-lock watermark: still correct, and scales the
  right way.** The watermark-safety argument is per-user: pull filters by `user_id`, the
  lock serializes only that user's pushes, and other tenants' interleaved commits can
  neither hide nor reorder a user's rows in their pull window. Tenants don't contend on
  the lock (that was the point of keying it by `user_id` — the original design
  accidentally future-proofed itself). The shared sequence just makes per-user seqs
  sparser, which is harmless. Stated explicitly in §3 now.
- **Hand-rolled sync engine: still the right call.** The rejected alternatives were
  rejected for reasons (service-in-the-middle, write path still yours, Expo maturity)
  that don't improve under isolated multi-tenancy. The redesign trigger is unchanged and
  now sharper: **cross-user sharing/co-editing** is the moment to reopen build-vs-adopt,
  because that breaks the per-user conflict argument everywhere at once.
- **Per-user scale statements: unchanged.** Tombstones-kept-indefinitely, full-resync
  cost, pull pagination, converter volume — all are per-tenant quantities (one person's
  photo metadata) and don't grow with user count. Reworded throughout sync-design from
  "single user" to per-user phrasing so nobody later mistakes them for global claims.

### 5.3 Changes made for multi-tenancy (beyond 5.1)

- **sync-design §2a (new): the multi-tenant isolation invariant** — token-derived
  `user_id` on every syncable row, composite PK, all queries token-scoped, per-user
  advisory lock, per-user S3 namespace, no cross-user references. §12 gained a Tenancy
  row; §13 backend logs must be tagged with `user_id`.
- **self-serve signup** (`POST /auth/signup`, response shape mirrors `login`, bcrypt +
  basic validation + per-IP throttle). Initially placed in phase-1; **moved to a new
  Phase 6 in the phasing pass (§6)** — the migration itself never needs a second real
  user. Deferred-hardening list (email verification, password reset, abuse/captcha,
  account deletion/export) is written down in phase-6 so "defer" doesn't become "forget".
- **phase-1: storage layout deviation** — shared multi-tenant bucket with
  `u/<user_id>/` key prefixes for new users (Rails' bucket-per-user hits AWS's
  ~100-bucket default cap and is provisioning drag). Reconciled with parity via a
  per-user storage resolver: the existing account keeps its legacy bucket (binaries never
  move — README convention updated), `storage_bucket` becomes nullable, the server always
  builds keys as `prefix + fileKey` from the token, presigned URLs only mint inside the
  requester's namespace. Client contract unchanged.
- **phase-1: per-user upload concurrency/size guard** (one tenant's bulk upload must not
  starve another's) alongside the per-IP auth throttles.
- **phase-4: converter scope note** — legacy-JSON import is for the one existing account
  only; future users start empty; still deleted in 5b. Cutover data migration remains
  just your own data.
- **README** — multi-tenant target stated up front; S3 convention bullet rewritten
  (legacy bucket for the existing user, shared+prefix for new users).
- The earlier fixes (per-device refresh tokens 1.5, per-user advisory lock, `user_id`
  from token) were already multi-tenant-shaped; they needed no rework, only the
  explicit invariant around them.

### 5.4 New open questions for the user

- **Signup UI timing:** ~~the endpoint lands in Phase 1 with no screen scheduled~~ —
  resolved structurally by the phasing pass (§6): endpoint + screen + quota now ship
  together as **Phase 6**, post-migration. Remaining question is only *when* to run
  Phase 6.
- **Per-user storage quotas/billing:** nothing stops a future signup from uploading
  unbounded data to your S3 bill. Fine while invite-only; before genuinely opening
  registration, add a per-user byte quota (cheap: sum of `fileSize` on their asset rows,
  enforced at upload). Now planned as Phase 6 step 3, landing *with* signup — the open
  question is just the limit you want.
- **Legacy bucket consolidation:** should the existing account's binaries eventually be
  moved into the shared bucket (one-off `move_file` sweep, post-5b) so the resolver's
  legacy branch can be deleted, or is the permanent two-path resolver acceptable? Either
  is fine; the resolver isolates the choice.
- **Deferred hardening trigger:** agree on the concrete moment the deferred auth list
  (email verification etc.) becomes due — e.g. "before the first non-me signup", not a
  date.

---

## 6. Addendum — phasing pass (2026-08-29)

A dedicated re-evaluation of the phase boundaries themselves, under the unchanged
constraint that every phase leaves the app buildable with the new path flag-gated.

### Kept as-is (evaluated, endorsed)

- **Phase 0 atomic** — the app is unbuildable mid-move; one revertable PR is right.
- **2a/2b split** — backend-only vs native-rebuild is exactly the seam that keeps a
  mid-phase checkpoint; the riskiest novel work (the sync protocol) gets tested (2a)
  before any app change (2b).
- **Phase 4 position** — the converter needs all collections (3b) and validates against
  real data right before cutover; nothing to move.
- **5a/5b split** — "prove in production while the old source still exists" vs "delete"
  are distinct risk profiles; collapsing them would gate deletion on nothing.
- **Phase 1 stays one phase** (not split 1a/1b): both halves are backend-only with a
  trivially-green app checkpoint, and 2b needs *both* auth and S3 parity (flag-on routes
  all traffic, including file uploads, to the new backend). Splitting would add doc
  ceremony without changing risk; the "small PRs" convention already gives intra-phase
  granularity (natural seams: auth core → storage/streaming → guards).

### Changed

1. **Signup moved out of Phase 1 into a new Phase 6 (open registration).** After the
   multi-tenant additions, Phase 1 was carrying auth parity + token-table deviation + S3
   parity/streaming + storage resolver + guards + signup. The right trim is the item with
   zero migration value: no phase in 0–5 needs a second *real* user (isolation tests use a
   seeded fixture user), and signup's natural companions — the app signup screen, the
   per-user quota, the hardening list — are all post-cutover. Phase 6 bundles them so the
   front door ships as one coherent feature, and the migration keeps only the
   schema-shaped multi-tenant work that would be painful to retrofit (composite PK,
   resolver, refresh-token table). Edited: README table + rationale, phase-1 (objective,
   deviations, steps 4/9, checklist, out-of-scope), phase-5b out-of-scope pointer, new
   `phase-6-open-registration.md`.
2. **Phase 3 split into 3a (Sync Inspector + observability) and 3b (albums/posts +
   triggers), in that order.** Old Phase 3 mixed four workstreams and — worse — built the
   debugging tool *last*. The Inspector is the instrument for debugging sync; it should
   exist the moment there is one collection to inspect, so 3b's scale-out, Phase 4's
   converter run, and the cutover soak are all observed through it. The Inspector is
   registry-driven, so 3b's collections appear in it with no rework (that's now an
   explicit 3b verification item). Edited: phase-3 file restructured, README table.
3. **All native modules batch-installed in Phase 2b — one pre-cutover native rebuild.**
   Previously 2b (expo-sqlite) and 3 (task-manager/background-task) each forced a
   dev-client build + `runtimeVersion` bump; for a solo dev the physical-device build
   cycle is the slowest loop in the plan. 2b now installs the background modules unused
   and unregistered (config-plugin keys applied, inert until 3b registers a task), making
   3a→4 pure JS on one dev build, OTA-updatable throughout. Explicit fallback recorded in
   2b step 7: if the batched modules cause any build trouble, drop them and give 3b its
   own rebuild (the original plan) rather than blocking the sync slice. Edited: phase-2
   step 7 + native section + out-of-scope, phase-3 prerequisites/native section, README
   native-module convention.

Net phase sequence: **0 → 1 → 2a → 2b (native) → 3a → 3b → 4 → 5a → 5b → 6**, with every
checkpoint rule unchanged.
