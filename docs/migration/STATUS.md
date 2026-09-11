# Migration Status

Progress tracker for the Rails→TypeScript + sync migration. The `/migrate` skill reads this
to find the next stage, executes it, and updates this file. **One stage per run.**

Statuses: `not-started` · `in-progress` · `blocked-on-user` · `done`

| Stage | Description | Doc | Status |
|-------|-------------|-----|--------|
| 0  | Foundation — monorepo, move app, TS/shared scaffold | `phase-0-foundation.md` | done |
| 1  | Backend skeleton — auth + S3 + multi-tenant schema (modern rewrite) | `phase-1-backend-skeleton.md` | done |
| 2a | Sync backend slice (`assets` endpoints + tests) | `phase-2-sync-slice.md` (§2a) | done |
| 2b | Sync client slice — SQLite + worker (clean rewrite, no flag; native build) | `phase-2-sync-slice.md` (§2b) | blocked-on-user |
| 3a | Sync Inspector + observability | `phase-3-collections-inspector.md` (§3a) | done |
| 3b | albums/posts + sync triggers | `phase-3-collections-inspector.md` (§3b) | done |
| 4  | Converter — import real S3 backup (runbook: `legacy-import.md`, skill: `/legacy-import`) | `phase-4-converter-parallel.md` | done (validated on real data) |
| 5a | Cutover — deploy backend | `phase-5-cutover.md` (§5a) | needs-user (deploy) |
| 5b | Cleanup — delete old path, retire Rails | `phase-5-cutover.md` (§5b) | needs-user |
| 6  | Open registration — signup + hardening | `phase-6-open-registration.md` | not-needed (private build) |

**Next stage:** none codeable — the migration is code-complete. Remaining is all user-side:
the device gate (native expo-sqlite validation of 2b+3b — `/todo.md`) and Phase 5 (deploy
`apps/server` + point the app at it + retire Rails). Phase 4 (converter) BUILT + validated
against real S3 data (see Log). Phase 6 (signup/quota) not needed — private single-user build.

## Known limitations (revisit before go-live)

- **Whole-record LWW membership loss — BEING FIXED via edge collections** (`edge-collections.md`).
  Membership (`album.assets`, `post.assetRefs`) is promoted to `album_assets` / `post_assets`
  junction collections (ordered by fractional-index `position`), so add/remove/reorder are
  independent edge writes that compose across devices — no more silent loss. `postHistory` /
  `lastPostedAt` are removed from synced state and derived on-device (they're a recomputable cache).
  - **Slice 1 (backend): DONE** — shared descriptors + fractional index, server tables + migration
    (`0003`), converter emits edges, 63 tests pass, real re-import validated (14837 album + 1117 post
    edges, all resolve, idempotent).
  - **Slice 2 (client): CODE-COMPLETE (device gate to validate on real expo-sqlite)** — SQLite edge
    tables + migration `0003`; `edgesRepository` (add/remove/reorder/setRefs via keyBetween, tombstone
    on delete); `derive.ts` synthesizes `album.assets`/`post.assetRefs` + derives postHistory/lastPostedAt
    so the ~78 consumers are unchanged; Albums/Posts/Assets providers rewired; legacy adapters strip
    dropped fields. 39 mobile tests pass incl. a **two-device add-vs-reorder e2e** (client SQLite ↔
    server Postgres) proving both survive. Obsolete postHistory-maintenance hooks are now no-ops
    (writes stripped) — safe to delete later.
- **Scalar-field concurrent edits still whole-record LWW** (e.g. rename vs favorite on the same
  album). Separate, additive fix deferred: per-field merge or ancestor-based 3-way merge. Not
  blocking; edges don't preclude it.

## Log

_Newest first. The skill appends one entry per run: what it did, what's pending, any
deviations from the plan._

- **2026-09-06 — Phase 6 marked not-needed (private build).** User: the app is a private
  single-user build, so open registration + per-user quota aren't needed now. A partial Phase 6
  (signup endpoint + quota) was built and then reverted (uncommitted, wiped) — the codebase is
  back at the clean 3b state. If the app is ever opened up, Phase 6's plan doc still stands.
  Migration is code-complete; only user-side gates remain (device build, Phase 5 deploy).
- **2026-09-06 — Stage 3b (albums + posts + triggers): done. Sync migration engine complete for
  all 3 collections.** Shared album/post descriptors + registry; server tables + triggers
  (registry-driven) + a registry guard test (table/trigger/composite-PK/round-trip/isolation for
  every collection). Client tables + a generic repository + generic legacyBase adapter +
  generic live-map; the worker's pull-apply/push-adopt are now collection-generic (were
  asset-hardcoded). Albums/PostsProviders rewired to SQLite (API + post-history preserved);
  album/post readers swept to `deletedAt`. Triggers: foreground + interval (`useSyncTriggers`) +
  on-mutation. Background-task module deferred to a device follow-up. Tests: mobile 30 (added a
  two-device **album** e2e proving the generic non-asset path), server 51 (3-collection guard);
  typechecks + bundle clean.
  - **Remaining:** Phase 6 (signup) — codeable, next. Phase 4 (converter) — deferred by the user
    (fresh login re-syncs). Phase 5 (deploy + retire Rails) — needs the user's infra/secrets.
    Device gate (2b+3b native expo-sqlite validation) — user, tracked in `/todo.md`.
- **2026-09-06 — Stage 3a (Sync Inspector + observability): done.** `sync_log` ring buffer +
  conflict/rebase notes written by the worker (in `finally`, so errors are logged); dev ops
  `clearOutbox` + `fullResync` (registry-driven wipe + repull); backend user_id-tagged push/pull
  structured logs. App `SyncInspector` (Settings→Developer): status + Sync now / Full resync /
  Clear outbox + per-collection stats + outbox + sync log; client collection registry. +5
  observability tests (mobile 29, server 48 all pass; typechecks clean; app bundles). No native
  rebuild (JS-only). Adapted from the doc's flag-gated checkpoints (flag removed per the
  clean-rewrite direction).
- **2026-09-06 — Direction change + Stage 2b started (clean rewrite, no flag).** User dropped
  the "works after every stage" requirement and the `useNewSync`/parallel-run model: the app is
  **rewritten directly** onto the new stack (old build + backups are the external safety net),
  data migration is deferred (fresh login re-sync or a later converter), auth points at the new
  backend, goal is "nice, clean, modern." Recorded in migration/README ("Clean-rewrite
  direction", supersedes the prime directive + flag conventions) and phase-2 §2b. Also chose to
  modernize the app's **data-consumption** layer (SQLite + reactive `useLiveQuery` hooks), not
  just storage. Background-task modules deferred to 3b.
  - **2b part 1 done + committed (`baa4654`): the client sync engine.** expo-sqlite + Drizzle
    (runtimeVersion bumped, `.sql` bundling via babel-inline-import + metro sourceExt); SQLite
    schema (assets/sync_meta/outbox) + generated migrations; cursor/status, coalesced outbox,
    assets repository (monotonic `updatedAt`), single-flight push→pull worker (skipped-lww adopts
    `current`; outbox-guarded apply), sync API client, and reactive `useLiveQuery` hooks.
    Verified: scoped `tsc` strict clean (drizzle needs strict — expo base doesn't set it, so
    `tsconfig.synccheck.json` enables it for `src/sync`); base app still bundles.
  - **2b part 1b done + committed: DI refactor, review fixes, full engine test coverage.**
    `/code-review` on the sync code found 5 real bugs — all fixed: skipped-lww outbox never
    cleared (→ pure `planPushOutcome` with a supersession check), no push chunking (→ batch of
    500), stale `syncError` never reset, cursor duplicated in the status blob, and `syncError`
    leaking into the create push payload. Also fixed a latent correctness bug the tests forced
    out: drizzle SQLite transactions are **synchronous**, so the async transaction callbacks
    were non-atomic — rewrote them to sync (`.run()/.get()/.all()`).
    Made the engine **dependency-injected** (`db` + `SyncTransport`) so it runs off-device:
    added **24 vitest tests** — pure logic (clock/push-planner/chunk), **real-SQLite** via
    better-sqlite3 (repository, outbox coalescing, push-result handling, outbox-guarded apply),
    and a **two-device e2e** (two better-sqlite3 devices ↔ the real server push/pull against
    docker Postgres: create propagation, concurrent-conflict convergence, tombstone). `npm test`
    (mobile) runs pure+engine; `npm run test:e2e` adds the two-device e2e; `npm run
    typecheck:sync` is strict-clean.
  - **2b part 2a done: provider + auth wired (bundles).** Rewrote `AssetsProvider` to be
    SQLite-backed: `useMigrations` gate → reactive `useLiveAssetsMap` + methods delegating to the
    repository and kicking `requestSync`. A legacy↔modern adapter (`sync/legacyAsset.ts`) lets
    existing screens/creation keep producing the old shape while the store runs modern. Auth
    repointed at the new backend: runtime base-URL override (`apiBaseUrl.js`, dev setting for a
    LAN IP/tunnel), `getUser` `/user`→`/me`, `logout` now sends `{refreshToken}` (login/refresh
    already matched). Full app **bundles** (2387 modules; expo-sqlite + drizzle + inlined `.sql`
    migrations all resolve).
  - **2b part 2b done: screen sweep + sync-status UI.** Asset reads modernized
    (`mediaType 'image'`→`'photo'` via the `MEDIA_TYPES` constant; asset `isDeleted`→`deletedAt`
    in the asset readers, album/post `isDeleted` left legacy). Live map keeps tombstones so the
    "Deleted" album still works. Added `useSyncStatus` + `SyncStatusControl` ("Sync now") in
    Settings→Developer. typecheck:sync clean, mobile tests pass, app bundles.
  - **2b is code-complete.** Remaining is the **device gate only** (tracked in `/todo.md`):
    fresh dev-client build (runtimeVersion 1.0.0) on a physical device + a real two-device
    check. This validates the native **expo-sqlite** path — the headless engine tests use
    better-sqlite3, so device behavior of the real native module is the one thing not yet
    exercised. Set 2b `done` once that passes. 3a (Inspector, JS-only) can proceed meanwhile.
- **2026-09-06 — Stage 2a (Sync backend slice): done. App untouched.**
  Built the generic sync engine for the `assets` collection, backend-only.
  - **`packages/shared`:** `defineCollection` (now `{ name, schema, localOnly }`) + base-record
    schema, the `assetCollection` descriptor (synced fields per sync-design §10; the three
    is*Synced flags are synced, `syncError` local-only), a collection registry, and the
    pull/push wire contracts (`contracts/sync.ts`). All Zod → shared FE/BE types.
  - **`apps/server`:** Postgres `assets` table with composite PK `(user_id, id)` +
    `(user_id, server_seq)` index; `server_seq` stamped by a `BEFORE INSERT/UPDATE` trigger
    attached registry-driven in `migrate.ts` (idempotent) alongside the `change_seq` sequence.
    `POST /api/v1/sync/pull` (per-collection fetch, global-merge, safe-watermark cursor, limit
    clamp) and `POST /api/v1/sync/push` (per-user `pg_advisory_xact_lock`, atomic
    `ON CONFLICT (user_id,id) … WHERE excluded.updated_at > …` strict-`>` LWW, future-ts clamp,
    `user_id` from token, per-mutation results with `skipped-lww` returning `current`). Generic
    over the registry (derives updatable columns from the descriptor).
  - **Verified on the local stack:** `tsc` clean; **48 vitest tests** (`npm run test:db`),
    incl. 8 DB-backed sync tests — pull window + tombstone delivery, LWW winner + `current`,
    idempotent strict-`>` replay (equal ts = no-op, **no server_seq re-stamp**), same-row
    multi-mutation ordering, concurrent pushes drop no rows (advisory lock), partial-push
    rejection persists only valid rows, pagination loop, and **tenant isolation** (B never
    sees A's rows; a colliding id lands in B's partition, A untouched). Mobile still exports —
    **app untouched**. Plain `npm test` skips the DB tests; `npm run test:db` runs them.
  - **Next (2b):** client SQLite + outbox + sync worker + `useNewSync` flag — the one
    pre-cutover **native rebuild** (expo-sqlite + batched background modules), so it has a real
    physical-device manual gate.
- **2026-09-06 — Stage 1 (Backend skeleton): built as a modern rewrite; code complete, all
  headless tests green; blocked on the live DB+S3 smoke gate.** Also marked **Stage 0 `done`**
  (user's call: the EAS build "is not a blocker"; it stays a non-blocking follow-up in
  `/todo.md`).
  - **Direction change (user-directed, docs updated).** This migration is now a **modern 2026
    rewrite**, not a byte-parity port. Because app+server are collocated, the app's API client
    will be updated to match a modern contract at wiring time (Phase 2b) rather than freezing
    the wire format. Updated `migration/README.md` (new "Direction" section) and
    `phase-1-backend-skeleton.md` (modernization section). Modern choices: single error
    envelope `{ error: { code, message } }`, `Authorization: Bearer`, RESTful shapes, uuid ids,
    `GET /me`.
  - **Built `apps/server`** (Fastify 5 + TS/ESM + Drizzle + Postgres + zod type provider):
    config (zod-validated env), Drizzle schema (`users` uuid PK, per-device `refresh_tokens`
    table, `change_seq` sequence) + generated migration, JWT (HS256, `{user_id,exp}`, shared
    Rails secret), bcryptjs passwords (Rails-digest compatible), refresh-token issue/rotate/
    revoke, Bearer auth (+`?token=` on upload only), per-user storage resolver (legacy bucket
    vs shared+`u/<id>/` prefix), S3 service, asset routes, rate limiting, log redaction,
    `/up`, seed + smoke scripts. Contracts (zod + inferred TS types) live in
    `packages/shared/contracts` — the shared FE/BE source of truth (user asked for this).
  - **Upload architecture — investigated & corrected mid-build.** Initially planned
    direct-to-S3 presigned uploads; the user flagged, and `apps/mobile/src/obsolete-code`
    confirmed, that Expo can't split large files for client-side multipart (comments: "Upload
    crashes on large files", "crashes on files larger than 2GB!") and a single S3 PUT caps at
    5 GB. So uploads stay **server-proxied streaming** with server-side multipart via
    `@aws-sdk/lib-storage`; downloads are direct presigned GETs. Documented in the contract +
    both plan docs.
  - **Verified headlessly (green):** `tsc` clean (server + shared); **40 vitest tests pass**
    (jwt incl. alg:none/expiry/tamper, bcrypt incl. imported-digest, refresh rotation,
    storage resolver + tenant isolation, presign/expiry rules, error envelope, and route-level
    auth + asset tests with DB/S3 mocked incl. 401s, validation, `?token=`, per-user namespace);
    Drizzle migration generates cleanly.
  - **Local dev stack added + Docker installed (user request).** `apps/server/docker-compose.yml`
    runs Postgres + MinIO (S3-compatible, buckets auto-created); `.env.docker` + `npm run
    local:setup` bring it up. Installed a headless Docker runtime on this machine for local dev
    (`colima` + `docker` + `docker-compose` via Homebrew; `~/.docker/config.json` points at the
    compose plugin). S3 client gained optional `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` (unset ⇒ AWS);
    made `@squidbox/shared` `"type": "module"` so its named exports resolve under Node+tsx (Vite
    had masked this) — re-verified the mobile bundle still exports fine.
  - **VERIFIED end-to-end on the local stack (Stage 1 checklist complete):**
    `npm run smoke` ⇒ **SMOKE: PASS** (login, /me, small upload+download+verify, >210 MB
    streaming upload with server-side multipart = 220,200,960 bytes verified, delete).
    `npm run verify:isolation` ⇒ **ISOLATION: PASS** (two devices hold independent refresh
    tokens, rotated token rejected; fixture user works in its own namespace; user B gets 404 for
    user A's object and B's delete leaves A's object intact). Plus `tsc` clean + 40 vitest tests.
    **Stage 1 = done.**

- **2026-09-06 — Stage 0: dev-client gate PASSED on device; committed; one gate left.**
  Restored `apps/mobile/.env.local` and booted Metro + ngrok tunnel from the new layout.
  Verified end-to-end: manifest 200, `launchAsset.url` correctly resolves to the monorepo
  path `/apps/mobile/index.bundle`, and the real Hermes bundle builds+serves over the tunnel
  (200). User confirmed on a physical device: **login, browse, and upload all work
  identically against Rails.** Committed the atomic Phase 0 change (see commit below).
  **Remaining:** the fresh EAS dev-client build from `apps/mobile/` — user is off-device and
  EAS/Apple secrets aren't set here, so it's tracked in `/todo.md`. Stage 0 stays
  `blocked-on-user` on that single item; flip to `done` (and Next stage → 1) once the build
  succeeds and installs. Package manager: staying on **npm workspaces** (pnpm considered and
  declined for now — its symlink layout fights RN/Metro/EAS; marginal benefit at this size).

- **2026-08-29 — Stage 0 (Foundation): code complete, blocked-on-user for device/EAS gates.**
  Converted the repo to an npm-workspaces monorepo on branch `phase-0-foundation` (one atomic
  commit). Moved the whole Expo app into `apps/mobile/` (327 tracked renames — history
  preserved), added root workspace `package.json` (dev tooling only: eslint/prettier/typescript)
  + `tsconfig.base.json` + `.easignore`, and created `packages/shared` (`@squidbox/shared`,
  zod dep, `defineCollection` placeholder). Deleted `jsconfig.json` (folded into
  `apps/mobile/tsconfig.json`). Fixed the three hoisting traps + one the plan under-specified.
  - **Verified headlessly (green):** root `npm install` resolves workspaces (`@squidbox/shared`
    symlinked; `expo`/`ngrok` hoisted to root); a full `expo export` iOS bundle succeeds (2157
    modules) — proving Metro monorepo resolution, the `@/` alias, **and** the runtime
    `@squidbox/shared` import in `App.js` all resolve; `tsc` on `packages/shared` passes; eslint
    on changed files = 0 errors.
  - **Deviations from the plan (docs updated in `phase-0-foundation.md`):**
    (1) **Entry point** — plan step 3's `import 'expo/AppEntry'` does **not** survive hoisting:
    `AppEntry.js` does `import App from '../../App'` relative to its own (now root-hoisted)
    location → resolves to repo root, bundle fails. Replaced with the standard
    `registerRootComponent(App)` + `import App from './App'` pattern in `apps/mobile/index.js`.
    (2) **ngrok path** — plan step 5's `require.resolve('ngrok/bin/ngrok')` fails against ngrok's
    `exports` map (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Used `join(require.resolve('ngrok'), '..',
    'bin', 'ngrok')` instead.
    (3) `.gitignore` needed **no** edit — its patterns are non-anchored and already match the
    nested `apps/mobile/` app (`.env.local`, `.expo/`, `node_modules/`). Left `mise.toml` at the
    repo root (plan mentioned a `.nvmrc`, which no longer exists — mise is the repo-wide Node
    toolchain). Also added a "run app commands from `apps/mobile/`" note to `README.md`,
    `AGENTS.md`, and the `cloud-ios-build` skill so the run workflow stays correct.
  - **PENDING — manual gates before Stage 0 can be marked `done` (see next message):**
    a physical-device dev-client run (login/browse/upload against Rails, unchanged) and one
    fresh EAS dev-client build from the new `apps/mobile/` layout. Branch is committed locally,
    not pushed / no PR opened yet (awaiting user).
</content>
