# Phase 3 — Sync Inspector (3a) + all collections & triggers (3b) (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).
> Ordering was deliberate: **tool before scale-out** — the Inspector is the instrument used to
> debug the scale-out that follows.

## Objective

Build the Sync Inspector dev screen (the replacement for "looking at the JSON files") plus the
engine observability it renders (3a); then scale the proven engine from one collection to all three
(`assets`, `albums`, `posts`) and add automatic sync triggers (3b).

## Outcome

**3a — done.** `sync_log` ring buffer + conflict/rebase notes written by the worker; dev ops
`clearOutbox` + `fullResync` (registry-driven wipe + repull); backend `user_id`-tagged push/pull
structured logs. App `SyncInspector` (Settings→Developer): status + Sync now / Full resync / Clear
outbox + per-collection stats + outbox + sync log.

**3b — done. Sync engine complete for all 3 collections.** Shared album/post descriptors +
registry; server tables + registry-driven triggers + a registry guard test (table / trigger /
composite-PK / round-trip / isolation for every collection). Client tables + generic repository +
generic legacyBase adapter + generic live-map; the worker's pull-apply/push-adopt became
collection-generic (were asset-hardcoded). Albums/PostsProviders rewired to SQLite. Triggers:
foreground + interval (`useSyncTriggers`) + on-mutation.
</content>
