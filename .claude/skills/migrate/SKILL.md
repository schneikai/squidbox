---
name: migrate
description: HISTORICAL — the Squidbox Rails→TypeScript + multi-device-sync migration is complete and deployed. This skill drove the phased migration, which is finished; it no longer has a "next stage" to run. For status see docs/migration/STATUS.md; for the live workflows use /deploy-server, /legacy-import, and /build.
---

# Squidbox migration runner (historical — migration complete)

**The migration is done and deployed.** The backend is live on Fly.io + Neon Postgres + AWS S3,
the full real library is imported, the app runs on the new sync stack, and membership is modeled
as edge collections. There is **no next stage to run** — do not attempt to "continue" or "run the
next phase."

If invoked, orient the user instead:

1. Read [`docs/migration/STATUS.md`](../../../docs/migration/STATUS.md) — the end state + the only
   remaining items, which are **user-side** (build a real Dev Client, test a photo upload, retire
   the old Rails droplet, rotate AWS keys) and are tracked in [`/todo.md`](../../../todo.md).
2. Point the user at the maintained workflows for anything ongoing:
   - **`/deploy-server`** — deploy the backend / run migrations in production.
   - **`/legacy-import`** — re-import the Rails library (idempotent; already done for prod).
   - **`/build`** — build the iOS App or Dev Client.
3. For design/history background: `docs/sync-design.md` (engine design),
   `docs/migration/edge-collections.md` (membership model), `docs/migration/README.md` (phase
   archive).

Do not resurrect the phased "one stage per run" flow — the phase docs (`phase-0..6-*.md`) are a
historical archive, not a live plan.
</content>
