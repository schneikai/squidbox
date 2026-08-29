# Phase 4 — One-shot converter + parallel run

## Objective

Add the throwaway **converter button** that imports the existing JSON data
(`assets.json`, `albums.json`, `posts.json`) into the new local SQLite (which then syncs to
the new backend), and run the new path in parallel with the old on **your own devices** to
validate with real data. Still behind `useNewSync` (default **off**).

## Checkpoint (definition of done)

- Flag **off**: app unchanged; ships.
- Flag **on** + converter run once: your real data appears as records in the new system,
  syncs to the new backend, is visible across your devices, and the **concrete parallel-run
  gate** (below) passes.
- Asset **files** are untouched in S3 (same `filename` keys); only metadata was imported.

## Prerequisites

- Phase 3 complete (3a Inspector + 3b all collections on the new path). JS-only from here
  to cutover — the dev build from 2b carries everything needed.
- Your existing JSON data present locally on the device.

## Steps

1. **Converter (dev-only button).** Behind a dev toggle:
   - read the three local JSON maps (`{ [id]: entity }`);
   - map old fields → new records: **carry over `isFileSynced`/`isThumbnailSynced`/
     `isSynced` as synced fields** (they are global "binary is in S3" facts — sync-design
     §4); reset only local-only `syncError`; `isDeleted` → `deletedAt`;
     **normalize/backfill `createdAt`/`updatedAt`** and **reject zero/negative
     timestamps** (a 0/missing `updatedAt` would lose all future LWW races or be
     future-clamped oddly); album `assets` and post `assetRefs` → JSON columns;
   - insert into local SQLite + enqueue outbox;
   - trigger a sync so the backend receives the metadata.
   Hardcode your data's assumptions; no validation polish; single-run.
2. **Idempotency guard + one-device rule.** Re-running skips ids already present (safe
   double-tap). **Run the converter on exactly one device**; every other device gets the
   data via a normal full pull (`cursor = 0`). Running it on a second device that holds
   older JSON would push stale whole records into LWW against freshly-synced ones —
   mostly no-ops, but pointless thrash at best and stale-wins at worst.
3. **Parallel-run validation** with a **concrete gate**, not "long enough": Inspector counts
   match old JSON for all three collections; zero unexplained conflict/overwrite notes in the
   sync log over the soak period; files still resolve on demand; spot-check
   albums/posts/favorites across two devices.
4. **Gap list.** Record mapping mismatches; fix in shared descriptors + converter.

## Notes / caveats

- **Multi-tenant scope:** the converter is for the one existing account's legacy JSON only.
  Future users who sign up start empty and never touch this path — it stays throwaway
  code deleted in Phase 5b, not a per-user onboarding feature. Cutover data migration is
  therefore still just your own data, regardless of the multi-user goal.
- `isDeleted → deletedAt = updatedAt` collapses delete-vs-edit ordering: a converted delete
  and a later edit with equal/slightly-higher `updatedAt` could undelete. Acceptable for a
  one-shot personal import; be aware.
- Dangling refs (album→asset, post→asset ids) are tolerated (JSON string arrays, no FK); the
  Inspector's dangling-file note covers file-vs-metadata mismatch.

## Files created / modified

- **Created:** converter module + dev button (in the Sync Inspector or a dev menu).
- **Modified:** shared descriptors / mapping if gaps found.

## Native rebuild needed?

No — JS-only (native deps from Phases 2–3 already in the dev client).

## Risks & mitigations

- **Mapping mismatches** (legacy shapes, `__UNKNOWN__` mediaLibraryAssetId, missing
  timestamps) → normalize known quirks; reject bad timestamps; log skipped/odd records.
- **Double import** → idempotency guard (step 2).
- **File/metadata mismatch** → surface as a dangling-file note; UI tolerates missing files.

## Recovery (fix forward)

Flag off = unaffected app. Converter/mapping problems are fixed forward: patch the mapping,
clear local SQLite (Full resync/wipe), and re-run. The old JSON/Rails data is never modified,
so a bad import is corrected by re-importing — nothing to revert.

## Verification checklist

- [ ] Flag off: app identical; ships.
- [ ] Converter run once **on one device only** → Inspector counts match old JSON (the gate).
- [ ] Data syncs to the new backend; second device populated via full pull, not the converter.
- [ ] Second device does **not** queue uploads for already-synced files (flags arrived via
      sync; upload queue skips absent local files — sync-design §4/§7a).
- [ ] Files still download on demand from S3.
- [ ] Re-running the converter does not duplicate.
- [ ] No records imported with zero/negative timestamps.

## Out of scope (later phase)

Flipping the default, retiring Rails and the JSON-blob endpoints (Phase 5).
</content>
