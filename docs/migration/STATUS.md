# Migration Status — COMPLETE + DEPLOYED

The Rails→TypeScript + multi-device-sync migration is **done and live**. This file records the
end state and the known limitations; the phase-by-phase planning archive lives in
[`README.md`](./README.md) + `phase-0..6-*.md`.

## What shipped

- **Backend live on Fly.io** (`squidbox-server`, region `lhr`) + **Neon Postgres** (Frankfurt) +
  **AWS S3** (`eu-west-1`). Fastify 5 + TS/ESM + Drizzle; JWT auth, per-device refresh tokens,
  server-proxied streaming uploads (multipart) + direct presigned downloads. Deploy via
  **`/deploy-server`**.
- **Full real library imported** — 14,855 assets / 424 albums / 920 posts + membership edges —
  via the one-shot converter (**`/legacy-import`**; runbook `legacy-import.md`). All ids are
  **canonical UUIDs** (converted from legacy nanoid / undashed-hex during import).
- **Collection sync** for all collections through the generic engine (`docs/sync-design.md`):
  `assets`, `albums`, `posts`, plus the membership **edge collections** `album_assets` /
  `post_assets`.
- **Membership as edge collections** (`edge-collections.md`) — `album.assets` and
  `post.assetRefs` are ordered edge rows keyed by a fractional-index `position`; the old JSON
  arrays are gone. `postHistory` / `lastPostedAt` are **derived on-device**, not synced.
- **App on the new stack** — expo-sqlite + Drizzle source of truth, outbox + single-flight sync
  worker, Sync Inspector (Settings→Developer). File-transfer clients moved to the new backend
  (`assets/download-urls`, `assets/upload/*`, `assets/delete`); the legacy JSON "Backup / Load
  from cloud" feature was removed.
- **First-sync UX** — a "Setting up your library…" gate on the initial bulk pull, with reactive
  queries paused during the initial pull so the UI doesn't stall.
- iOS builds via **`/build`** (asks App vs Dev Client).

## Remaining (user-side only — no code left)

Tracked in [`/todo.md`](../../todo.md):

- Build a real **Dev Client** — "Squidbox Dev" needs a rebuild to include the `expo-sqlite`
  native module.
- **Test a photo upload** end-to-end against the deployed backend.
- **Retire the old DigitalOcean Rails droplet.**
- **Rotate the AWS keys** that were pasted into terminals/chats during setup/import.

## Known limitations (current)

- **Scalar-field concurrent edits are whole-record LWW** (e.g. rename vs favorite on the same
  album resolves to one writer). Edge collections fixed membership loss (add/remove/reorder now
  compose across devices), but scalar fields still ride whole-record last-write-wins. A per-field
  or ancestor-based 3-way merge is a separate, additive future upgrade — not blocking; edges don't
  preclude it.
- **First-full-sync perf polish.** The initial bulk pull (~32k records) is gated + reactive
  derivation is paused during it, but the derivation (`sync/derive.ts` — synthesizes
  `album.assets`/`post.assetRefs` and derives `postHistory`/`lastPostedAt`) is still a full
  recompute; memoizing/incrementalizing it is a follow-up if first-sync ever feels slow again.
</content>
</invoke>
