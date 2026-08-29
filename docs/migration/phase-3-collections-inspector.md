# Phase 3 — Sync Inspector first (3a), then all collections + triggers (3b)

Split into **3a** (Sync Inspector + observability plumbing, built against the working
`assets` slice) and **3b** (albums/posts scale-out + foreground/background sync triggers).
The ordering is deliberate: **tool before scale-out** — the Inspector is the instrument
used to debug everything that follows (3b's collections, Phase 4's converter, Phase 5's
cutover), so it lands as soon as there is one real collection to inspect, not after all
three. Both sub-phases are **pure JS** — every native module was batch-installed in the
Phase 2b build. Still behind `useNewSync` (default **off**).

## Objective

Build the Sync Inspector dev screen — the replacement for "looking at the JSON files" —
plus the engine observability it renders (3a); then scale the proven engine from one
collection to all three (`assets`, `albums`, `posts`) and add automatic sync triggers (3b).

## Checkpoints (definition of done)

- **3a:** flag off → app unchanged, no new startup side effects; ships. Flag on → the
  Inspector shows status, per-collection counts (just assets so far), outbox, sync log
  (incl. conflict/rebase notices), and per-asset file state — per sync-design §13.
- **3b:** flag off → unchanged; ships. Flag on → assets, albums, posts all run on the new
  sync path in a dev build; edits are reactive; sync runs on foreground + on-mutation
  (background is a bonus); the Inspector's per-collection views show all three (they are
  registry-driven, so no Inspector rework).

## Prerequisites

- Phase 2 vertical slice working (assets round-trip, generic pull/push, registry, minimal
  status surface from 2b step 12).
- Background native modules present in the dev build (batched in 2b step 7). If the 2b
  fallback was taken (modules dropped from that build), 3b needs its own dev-client build
  + `runtimeVersion` bump before step 6.

## Phase 3a — Sync Inspector + observability (JS-only)

1. **Engine: observability plumbing.** `sync_log` ring-buffer table; `sync_status` fields
   in `sync_meta`; optional per-row `dirty` column; the worker writes a conflict note when
   a local change loses LWW (`skipped-lww` → `current` adoption, sync-design §6/§13).
   Backend: structured push/pull logging (tagged with `user_id`; counts,
   applied/skipped/rejected, watermark).
2. **App: Sync Inspector screen** (dev/settings) per sync-design §13: status header +
   **Sync now / Full resync (wipe local tables + repull from `cursor=0`, warn on pending
   outbox) / Clear outbox**; per-collection record/pending/tombstone counts + **browse raw
   records** (search) — the JSON-file replacement; outbox list; sync log with
   conflict/rebase notices; per-asset file/thumbnail state. Build every per-collection
   view off the **collection registry**, so 3b's collections appear with zero Inspector
   changes.
3. **Dogfood the assets slice** (flag on) using the Inspector — force a conflict, watch
   the note appear; force a rejection, watch the outbox flag it.

## Phase 3b — albums + posts + sync triggers (JS-only)

4. **Backend: albums + posts collections.** Postgres tables (base cols + domain fields;
   ordered lists as JSON columns per sync-design §10), **each with its `server_seq`
   trigger attached**, primary key `(user_id, id)`, registered in the collection registry.
   Pull/push already generic. Extend the **registry-driven test** (sync-design §9): for
   every registered collection, assert the table exists, the trigger is attached, the PK
   is the composite `(user_id, id)` (sync-design §2a), an insert round-trips through pull,
   and a second user's pull does **not** see it — the forgotten trigger and a plain-`id`
   PK are the two silent per-collection failure modes.
5. **Shared + app: descriptors, local tables, repositories.** Add `albumCollection` and
   `postCollection`; SQLite tables for albums/posts, routed through the same repository/
   provider boundary used for assets (hydrated in-memory maps per sync-design §8); DB
   migrations stay lazy (flag-on only).
6. **App: triggers.** Foreground + on-mutation (debounced) via `AppState`/`setInterval`
   (plain JS) as the **primary** path. Register the opportunistic background top-up via
   the already-installed `expo-background-task` + `expo-task-manager`. **The background
   task must be registered only when the flag is on (or no-op immediately when off)** so a
   flag-off session has no new side effects.
7. **Full-app dogfood (flag on)** — all three collections, watched through the Inspector.

## Native rebuild needed?

**No** — both sub-phases are JS-only; `expo-sqlite`, `expo-task-manager`, and
`expo-background-task` (incl. its prebuild-applied Info.plist keys:
`UIBackgroundModes: ["processing"]`,
`BGTaskSchedulerPermittedIdentifiers: ["com.expo.modules.backgroundtask.processing"]`; CNG
applies these at EAS build) shipped in the Phase 2b build. **iOS Background Tasks do not
run on the simulator** — verify background behavior on a physical device. (Only if the 2b
batching fallback was taken: 3b needs one dev-client build + `runtimeVersion` bump.)

## Risks & mitigations

- **Ordered-list conflict loss** (album.assets JSON + LWW) → accepted; surface it in the
  sync log so it's visible, not silent. Join-table upgrade is future work.
- **iOS background is best-effort** (`BGTaskScheduler` ~15 min, OS-throttled, no simulator)
  → rely on foreground + on-mutation; treat background as a top-up. Don't promise instant
  background delivery.
- **Background registration as a flag-off side effect** → register only when flag on (step 6).
- **Inspector querying large tables** → paginate/scope the raw-record browser (dev tool, lazy).
- **Repository boundary drift** → every collection's UI goes through the same interface so
  the flag switches all three cleanly.
- **Inspector hardcoding the assets collection** → registry-driven views (step 2), verified
  when 3b's collections appear without Inspector changes.

## Recovery (fix forward)

Flag off is the default, so the shipping app is unaffected. Problems on the flag-on path are
fixed forward (patch the collection/worker/Inspector). Native modules (present since 2b)
can't be undone by a flag flip — we fix forward rather than remove them.

## Verification checklist

- [ ] 3a: flag off → app identical, no new startup side effects; ships.
- [ ] 3a: Inspector shows status, counts, outbox, log (force a conflict note), file state.
- [ ] 3b: flag off → app identical; ships.
- [ ] 3b: assets/albums/posts round-trip across two devices; Inspector shows all three with
      no Inspector changes.
- [ ] 3b: foreground + on-mutation sync works without manual trigger; background fires
      opportunistically on device.
- [ ] Full-resync (wipe + repull from `cursor=0`) rebuilds local state correctly.
- [ ] Deleting an asset on device A tombstones it on B **and** removes B's local
      file/thumbnail copies (sync-design §7a).

## Out of scope (later phases)

The data converter, running against real production data, cutover, Rails retirement,
signup/registration (Phase 6).
