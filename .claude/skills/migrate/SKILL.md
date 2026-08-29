---
name: migrate
description: Resume the Squidbox Rails→TypeScript + multi-device-sync migration. Reads the plan and the progress tracker, then executes the NEXT stage (one per run). Use when the user wants to start/continue the migration, run the next stage, or asks "what's next" on it.
---

# Squidbox migration runner

Drives the migration one stage at a time so a fresh session can pick up where the last left
off. The plan is the source of truth; `STATUS.md` is the progress cursor.

## On every invocation

1. **Load state.** Read `docs/migration/STATUS.md`. Find the current stage:
   - If a stage is `in-progress` or `blocked-on-user`, that is the current stage (resume it).
   - Otherwise the current stage is the first `not-started` row (see **Next stage**).
2. **Load the plan.** Read `docs/migration/README.md` (conventions + checkpoint rules) and
   the phase doc (+ section) for the current stage. Read `docs/sync-design.md` when the
   stage touches sync (2a/2b/3a/3b/4). Skim `docs/migration/fable-review.md` for caveats.
3. **Orient the user (briefly).** State which stage you're running, its objective, and your
   plan for this run. Then proceed — don't wait for approval unless a real decision is open.
4. **Execute the stage** per its doc, honoring the conventions (below). Do the codeable
   work; make small, focused commits/PRs as the doc's "small PRs" convention suggests.
5. **Handle manual gates.** Some steps need the user or a device — EAS/dev-client builds,
   physical-device or two-device tests, deploys, secrets. Do all the code up to that point,
   then set the stage `blocked-on-user`, and tell the user *exactly* what to do and what to
   report back. **Do not mark a stage `done` until its verification checklist passes**,
   including manual gates the user has confirmed.
6. **Update `STATUS.md`.** Set the stage's status, update **Next stage**, and append a Log
   entry: what you did, what's pending, any deviation from the plan.
7. **Stop.** Run **one stage per invocation**. End by stating the stage's status and what the
   next stage will be. Do not roll into the next stage.

## Non-negotiable conventions (from README.md — re-read it, don't trust memory)

- **Every stage leaves the app buildable and runnable.** With `useNewSync` **off**, behavior
  is identical to before and no new-path side effect runs at startup. The flag defaults off
  until Phase 5a.
- **Fix-forward, no rollback.** If something breaks, patch forward; never revert to Rails.
  Keep old data read-only until the plan says to delete it.
- **Native modules** (expo-sqlite in 2b; background-task batched in 2b) require a
  `runtimeVersion` bump and a fresh dev-client build; guard against OTA crashes per README.
- **Multi-tenant isolation:** every syncable table/query scoped by token-derived `user_id`;
  composite PK `(user_id, id)`; no cross-user access.
- Phase 0 is **one atomic PR** (exception to small-PRs).

## Guardrails

- If reality diverges from the plan (a step is wrong, a dependency won't install, an ordering
  problem), **update the affected plan doc + note it in the Log** rather than silently
  improvising. The docs must stay the source of truth.
- Never skip a stage's verification checklist to mark it done.
- Never advance past a `blocked-on-user` gate on the user's behalf (builds, deploys,
  device tests, secrets).
- If asked to "do the whole thing," decline and run the next single stage — explain the
  one-stage-per-run design and that the user reviews between stages.

## Stage → doc map

`STATUS.md` holds the authoritative list. Current sequence:
**0 → 1 → 2a → 2b → 3a → 3b → 4 → 5a → 5b → 6.**
</content>
