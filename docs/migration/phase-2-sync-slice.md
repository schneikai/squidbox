# Phase 2 — Sync vertical slice (`assets` end-to-end)

Split into **2a** (backend only — app untouched, trivially green) and **2b** (app SQLite +
worker + flag — the native-rebuild PR). This isolates the native rebuild and keeps a
checkpoint mid-phase.

## Objective

Prove the whole sync engine with **one collection** (`assets`): generic `pull`/`push` on the
backend, then local expo-sqlite + Drizzle + outbox on the client, LWW + tombstones + the
safe `server_seq` cursor. Everything behind `useNewSync` (default **off**), on the dev
client. De-risks the scary part before scaling to all collections. Syncs asset **metadata
records** only; binary files continue via the existing S3 flow.

## Prerequisites

- Phase 1 backend (auth + Storage) running and **reachable from physical devices** (LAN IP
  or a tunnel for `apps/server`); the app selects its base URL **at runtime** by the flag
  (not via build-time `EXPO_PUBLIC_API_URL`, which can't switch on a runtime toggle).
- **Auth routing decided:** either the shared JWT secret makes Rails-issued tokens valid on
  the new backend, or login is routed to the new backend when the flag is on. Without this,
  sync endpoints 401 and the 2b checkpoint can't be met.
- `change_seq` sequence exists; the per-table `server_seq` trigger and the
  `pg_advisory_xact_lock(user_id)` write-serialization (sync-design §3) are implemented.

## Phase 2a — backend sync slice (app untouched)

1. **Postgres `assets` table** with base columns (`id, created_at, updated_at, deleted_at,
   user_id, server_seq`) + asset domain fields (sync-design §10), **primary key
   `(user_id, id)`** (composite — sync-design §2a; `id` alone lets a colliding
   client-generated uuid touch another tenant's row). Attach the
   `BEFORE INSERT OR UPDATE` `server_seq` trigger.
2. **`packages/shared`:** `assetCollection` descriptor (Zod synced schema + `localOnly`) +
   the collection registry (just assets for now).
3. **`POST /api/v1/sync/pull`** — per-collection `limit` fetch, global-merge, safe-watermark
   cursor, `limit` clamp (sync-design §5).
4. **`POST /api/v1/sync/push`** — per-user advisory lock, atomic
   `ON CONFLICT (user_id, id) … WHERE excluded.updated_at > …` LWW (strict `>`, composite
   conflict target, per sync-design §6/§2a), future-timestamp clamp, `user_id` from token,
   **per-mutation result array** (`applied`/`skipped-lww`/`rejected`) where **`skipped-lww`
   includes the server's winning record (`current`)** — required for client convergence
   (sync-design §6). No hard deletes.
5. **Backend tests (incl. the race cases):** pull window, tombstone delivery, LWW winner,
   idempotent strict-`>` replay (equal timestamp = no-op, no `server_seq` re-stamp),
   concurrent-same-row push (TOCTOU on the atomic upsert), concurrent distinct-transaction
   commit-order gap (the safe-watermark hazard), partial-push rejection (rejected rows
   stay in the outbox), **`skipped-lww` returns `current`** with the winning row, and
   **tenant isolation**: user B's pull never returns user A's rows; user B pushing a
   record with an `id` that exists for user A creates/updates a row in **B's** partition
   and leaves A's row untouched.

**2a checkpoint:** backend tests green; app completely untouched → trivially still builds/runs.

## Phase 2b — client sync slice (native rebuild)

6. **Repository boundary first (own PR, behavior-preserving).** Extract the existing asset
   data source behind a repository interface with **no behavior change** and the flag still
   off. This is a pure refactor of the default path; land it before any new-sync code.
   Note the boundary preserves the provider's public shape (in-memory `assets` map +
   methods) — the flag will later swap the *persistence + sync* underneath, not the
   reactivity model consumers see (sync-design §8).
7. **Add expo-sqlite + Drizzle — and batch the Phase-3b native modules.** Install via
   `npx expo install expo-sqlite expo-task-manager expo-background-task` (SDK-55-aligned;
   New-Arch ready) + `drizzle-orm` (stable) + `drizzle-kit` (dev). The two background
   modules are **installed but entirely unused/unregistered** here — batching them makes
   this build **the only pre-cutover native rebuild**, so Phases 3a–4 are pure JS on this
   same dev build (incl. the `expo-background-task` config-plugin Info.plist keys, applied
   now, inert until 3b registers a task). Fallback: if either background module causes
   any trouble in this build, drop it from 2b and give 3b its own rebuild — don't let
   batching block the sync slice. **Bump `runtimeVersion`** (native modules added — see
   README native rule). If/where `useLiveQuery` is used (e.g. the Inspector later), the DB
   must be opened with `openDatabaseSync(name, { enableChangeListener: true })`.
8. **Bundle Drizzle migrations (config).** Add `babel-plugin-inline-import` (for `.sql`) to
   `babel.config.js` and `'sql'` to `config.resolver.sourceExts` in `metro.config.js` (mutate
   the object from `getSentryExpoConfig`, like the existing `unstable_enablePackageExports`
   line); `expo start --clear` after. *Or* run migrations imperatively without bundled `.sql`
   — decide explicitly. (This is a JS/config change, not a native rebuild.)
9. **Local DB.** `assets` table (synced + local-only cols), `sync_meta(key,value)` (cursor +
   status), `outbox`. **DB open/migrate must be lazy** — only on first flag-on use — so a
   flag-off session has zero new startup side effects.
10. **Sync worker (single-flight).** Push drains outbox → clears `applied`; for
    `skipped-lww` adopts the returned `current` record + clears; keeps/flags `rejected` →
    pull from cursor → **outbox-guarded apply** (apply iff the record has no pending outbox
    mutation — never timestamp-compare against committed local state; sync-design §5) →
    advance cursor, each page in one transaction. Local writes set a **per-record monotonic
    `updated_at`** (`max(now, prev + 1)`, sync-design §6). Manual "Sync now" dev button for
    now.
11. **Flag + parallel path.** `useNewSync` off → existing asset path (untouched). On → the
    SQLite-backed asset repository: hydrate the provider map from SQLite, route writes
    through the transactional repo (row + outbox), worker applies pulls to SQLite + the map
    (sync-design §8). Single boundary (from step 6).
12. **Minimal status surface** (seed of the Phase 3a Inspector): `phase` + pending count.
13. **Two-device test** on two dev builds signed to the same user.

## Native rebuild needed?

**Yes (2b)** — `expo-sqlite` (+ the batched, still-unused background modules) is native;
fresh dev-client build + `runtimeVersion` bump. Test on a **physical device**. 2a needs
none. This is intended to be **the only native rebuild until the Phase 5a cutover build**.

## Risks & mitigations

- **expo-sqlite/Drizzle on SDK 55 / New Arch** → install via `expo install` (not `@next`);
  trivial read/write on device before building further.
- **`useLiveQuery` inert** → `enableChangeListener: true` (step 7).
- **Flag leakage / startup side effects** → lazy DB open/migrate; one repository boundary;
  default off. Add "no new-path side effect with flag off" to the DoD.
- **Auth 401 on sync** → resolve the auth-routing prerequisite first.
- **Concurrency bugs** → the 2a race tests are mandatory, not optional.
- **Native change is sticky** → expo-sqlite can't be removed by a flag flip (needs a
  rebuild); we fix forward rather than remove it.

## Recovery (fix forward)

The `useNewSync` flag defaults off, so the shipping app is unaffected while the new path is
built — staged rollout, not a rollback lever. If the flag-on path misbehaves, fix it forward
(patch the worker/schema/endpoint) with the flag still off for normal use.

## Verification checklist

- [ ] 2a: backend race + protocol tests green; app untouched.
- [ ] Flag off: app identical; no new startup side effects; ships.
- [ ] Fresh dev-client build (runtimeVersion bumped) runs on a physical device.
- [ ] Flag on: asset create/favorite/delete round-trips A→B; UI updates on local write and
      on pull-apply.
- [ ] Partial-push rejection keeps the rejected outbox row (no silent loss).
- [ ] Forced conflict: B edits a record A also edited offline → loser gets `skipped-lww`,
      adopts the returned `current`, and both devices converge (byte-identical rows).

## Out of scope (later phases)

The full Sync Inspector (3a), albums/posts and sync triggers (3b), the converter (4),
cutover (5). The background modules are *installed* here but not touched until 3b.
</content>
