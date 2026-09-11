# Phase 2 — Sync vertical slice, `assets` end-to-end (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).
> Split into 2a (backend) and 2b (client). Design: [`../sync-design.md`](../sync-design.md).

## Objective

Prove the whole generic sync engine on one collection (`assets`): generic `pull`/`push` on the
backend, then expo-sqlite + Drizzle + outbox on the client, with LWW + tombstones + the safe
`server_seq` cursor. De-risks the engine before scaling to all collections.

## Outcome

**2a (backend) — done.** `defineCollection` + base-record schema in `packages/shared`, the
`assetCollection` descriptor, a collection registry, pull/push wire contracts. Server: Postgres
`assets` table with composite PK `(user_id, id)` + `(user_id, server_seq)` index; `server_seq`
stamped by a `BEFORE INSERT/UPDATE` trigger attached registry-driven in `migrate.ts`;
`POST /api/v1/sync/pull` (safe-watermark cursor) + `POST /api/v1/sync/push` (per-user
`pg_advisory_xact_lock`, atomic `ON CONFLICT (user_id,id)` strict-`>` LWW, per-mutation results
with `skipped-lww` returning `current`). Generic over the registry. 48 vitest tests incl. 8
DB-backed sync tests (pull window/tombstones, LWW, idempotent replay, concurrent-push safety,
pagination, tenant isolation).

**2b (client) — done.** expo-sqlite + Drizzle (SQLite schema + generated migrations,
`.sql` bundling via babel-inline-import + metro sourceExt); cursor/status, coalesced outbox, assets
repository (monotonic `updatedAt`), single-flight push→pull worker (outbox-guarded apply;
`skipped-lww` adopts `current`), sync API client, reactive hooks. `AssetsProvider` rewritten
SQLite-backed behind a `useMigrations` gate; auth repointed at the new backend. Engine is
dependency-injected so it runs off-device: pure-logic + real-SQLite (better-sqlite3) tests + a
two-device e2e against docker Postgres. The native `expo-sqlite` path is validated on a real device
(dev-client build — user-side, see `STATUS.md` / `/todo.md`).
</content>
