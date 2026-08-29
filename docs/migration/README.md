# Migration Plan — Overview

Migrating the Squidbox backend from Ruby/Rails to a new in-repo TypeScript backend
built around real multi-device sync, while porting the Expo app to TypeScript
incrementally. Target is **isolated multi-tenant**: each user's private data syncs across
that user's own devices only — no cross-user sharing ("just me now, open later"; see
sync-design §2a). Sync engine design lives in [`../sync-design.md`](../sync-design.md).

## Prime directive: every phase is a usable checkpoint

At the end of **every** phase, `apps/mobile` **builds and runs** with existing behavior
intact. New functionality lands behind a feature flag that defaults **off** until Phase 5
(cutover). You can stop after any phase and still ship the app.

"Usable checkpoint" means more than "the flag-on path works" — it means **with the flag
off, nothing new executes**: no new startup side effects, no DB open/migrate, no background
task registration (see the flag-boundary rule below).

## Conventions

- **Feature flag `useNewSync`** — a runtime dev setting plus an env default (off). Until
  Phase 5 the app's real data path stays **Rails + JSON blobs**. The new sync path only
  runs when the flag is on.
- **Flag boundary is strict** — the flag must gate not just the data-read path but every
  new-path side effect: opening/migrating the SQLite DB (lazy, on first flag-on use),
  registering background tasks, and any auth routing change. A module-scope `import` of a
  native module is **not** flag-guardable — see the native rule below. Add "no new-path
  side effect runs with the flag off" to each phase's definition of done.
- **Parallel run** — the existing Rails API stays live and untouched until Phase 5.
- **Recovery is fix-forward** — we never revert to the previous system to recover. Every
  phase keeps a working checkpoint, and problems are fixed by patching forward (a new
  commit/deploy on top), not by rolling back. The `useNewSync` flag is staged rollout (the
  new path is opt-in until proven), not a rollback lever. Retaining old data read-only
  before deleting it is data safety, not a rollback path.
- **New-system backups are a fix-forward prerequisite, not rollback.** Today the S3 JSON
  blobs + Rails `data_backups` are versioned snapshots of all metadata. After cutover, the
  new Postgres is the *only* metadata source — and fix-forward is impossible if the data
  itself is lost (bad migration, converter re-run gone wrong, fat-fingered SQL). Automated
  Postgres backups (managed-provider backups or a `pg_dump` cron with retention) must
  exist **before** the Phase 5a flip. Tombstone-only deletes help, but they don't protect
  against schema mistakes or bad bulk updates.
- **Binaries never move** — the existing account's asset files stay in their current
  (legacy per-user) bucket, which both backends read/write during the migration, so
  photos/videos are unaffected throughout. New users signing up later get keys in a single
  shared multi-tenant bucket under a per-user prefix (`u/<user_id>/…` — phase-1 storage
  deviation); the server resolves bucket + prefix per user, invisibly to the client.
- **Small PRs** — each phase is one or more small PRs; every merge keeps the checkpoint
  green. **Exception: Phase 0 is one atomic PR** (the app move can't be split into
  individually-green PRs) — see phase-0.
- **Native modules + OTA (critical)** — all new native modules (`expo-sqlite` **and**
  `expo-task-manager`/`expo-background-task`) are **batch-installed in Phase 2b** so there
  is exactly one pre-cutover native rebuild; the background modules sit unused (and
  unregistered) until Phase 3b, which is then pure JS. A native module is resolved at
  `require` time, before any flag check, so it **cannot** be guarded by `useNewSync`.
  Adding one to the JS bundle means:
  1. **Bump `runtimeVersion`** so a stale OTA/EAS Update bundle can never be delivered to an
     installed binary that lacks the module (which would crash on load — even for flag-off
     users).
  2. Do **not** ship OTA updates carrying the new import to old preview/prod binaries during
     Phases 2–4; those users get the module only via a fresh build.
  3. Optionally, `import()` the native module dynamically inside the flag-on path so a
     flag-off session never touches it.
- **TS port is opportunistic** — `allowJs` stays on; convert new/touched files as you go;
  never block a phase on full conversion.

## Backend reachability during Phases 2–4

The new backend must be reachable **from physical devices** during the pre-cutover sync
phases (two-device tests), not just localhost. Run `apps/server` on a LAN IP or behind a
tunnel (analogous to the existing Metro `tunnel.js`). The app selects the API base URL **at
runtime** based on the flag (the new backend's URL from a dev setting/config) — `EXPO_PUBLIC_*`
vars are inlined at build time and can't switch on a runtime toggle, so don't rely on
swapping `EXPO_PUBLIC_API_URL` for the flag. This is a prerequisite for Phases 2–4, not just
Phase 5.

## Target repo layout (after Phase 0)

```
/apps/mobile      the Expo app (moved from repo root)
/apps/server      new Fastify + TS backend (created Phase 1)
/packages/shared  Zod collection descriptors + inferred types (the contract)
```

## Phases

| # | Name | New capability | App still ships? |
|---|------|----------------|------------------|
| 0 | Foundation | monorepo, app moved, shared + TS scaffold | yes — behavior unchanged |
| 1 | Backend skeleton | Fastify auth + S3 asset parity, multi-tenant-ready (not wired in; no signup yet) | yes — app still on Rails |
| 2a | Sync backend slice | `assets` sync endpoints + descriptor + tests (app untouched) | yes |
| 2b | Sync client slice | expo-sqlite + worker + flag, `assets` end-to-end; **the one pre-cutover native rebuild** (background modules batch-installed, unused) | yes — flag off by default |
| 3a | Sync Inspector | inspector + observability plumbing, built against the assets slice (JS-only) | yes — flag off by default |
| 3b | Collections + triggers | albums/posts scale-out + foreground/background sync (JS-only) | yes — flag off by default |
| 4 | Converter + parallel run | one-shot JSON→SQLite import, validation | yes — flag off by default |
| 5a | Cutover | deploy backend, flip default on, verify in prod | yes — on new backend |
| 5b | Cleanup | after soak: delete old path + converter, retire Rails | yes |
| 6 | Open registration | signup endpoint + app signup screen + per-user quota (post-migration, own timeline) | yes |

Phase-boundary rationale: **tool before scale-out** (the Inspector is how sync gets
debugged, so it lands right after the first collection works, not after all three);
**one pre-cutover native rebuild** (2b batches every new native module, so 3a–4 iterate
as plain JS on the same dev build); **signup is not migration work** (nothing in Phases
1–5 needs a second real user — isolation tests use a seeded user — so onboarding lives
in Phase 6 where it ships together with its UI and quotas).

## Checkpoint verification (run at the end of every phase)

1. `npm install` at the repo root succeeds (workspaces resolve).
2. Metro starts and the dev client loads the JS bundle over the tunnel.
3. The app launches and core flows work as before (login, browse library, upload a file).
4. With `useNewSync` **off**, behavior is identical to pre-migration **and** no new-path
   side effect runs at startup (no DB open/migrate, no background registration).
5. (Phases that add native code) a fresh dev-client build installs and runs on a **physical
   device**, and `runtimeVersion` was bumped.

## How to use these docs

Each `phase-N-*.md` is self-contained: objective, the exact checkpoint/definition-of-done,
prerequisites, concrete steps, files touched, whether a native rebuild is needed, risks +
mitigations, rollback, a verification checklist, and what is explicitly out of scope
(deferred to a later phase).
</content>
