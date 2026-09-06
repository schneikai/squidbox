# Migration Status

Progress tracker for the Rails→TypeScript + sync migration. The `/migrate` skill reads this
to find the next stage, executes it, and updates this file. **One stage per run.**

Statuses: `not-started` · `in-progress` · `blocked-on-user` · `done`

| Stage | Description | Doc | Status |
|-------|-------------|-----|--------|
| 0  | Foundation — monorepo, move app, TS/shared scaffold | `phase-0-foundation.md` | done |
| 1  | Backend skeleton — auth + S3 + multi-tenant schema (modern rewrite) | `phase-1-backend-skeleton.md` | done |
| 2a | Sync backend slice (`assets` endpoints + tests) | `phase-2-sync-slice.md` (§2a) | done |
| 2b | Sync client slice — expo-sqlite + worker + flag (native build) | `phase-2-sync-slice.md` (§2b) | not-started |
| 3a | Sync Inspector + observability | `phase-3-collections-inspector.md` (§3a) | not-started |
| 3b | albums/posts + sync triggers | `phase-3-collections-inspector.md` (§3b) | not-started |
| 4  | Converter + parallel run | `phase-4-converter-parallel.md` | not-started |
| 5a | Cutover — deploy + flip default | `phase-5-cutover.md` (§5a) | not-started |
| 5b | Cleanup — delete old path, retire Rails | `phase-5-cutover.md` (§5b) | not-started |
| 6  | Open registration — signup + hardening | `phase-6-open-registration.md` | not-started |

**Next stage:** 2b — Sync client slice (expo-sqlite + worker + flag; the one pre-cutover
native rebuild). ⚠️ Needs a physical-device dev-client build — a real manual gate.

## Log

_Newest first. The skill appends one entry per run: what it did, what's pending, any
deviations from the plan._

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
