# Migration Status

Progress tracker for the Rails→TypeScript + sync migration. The `/migrate` skill reads this
to find the next stage, executes it, and updates this file. **One stage per run.**

Statuses: `not-started` · `in-progress` · `blocked-on-user` · `done`

| Stage | Description | Doc | Status |
|-------|-------------|-----|--------|
| 0  | Foundation — monorepo, move app, TS/shared scaffold | `phase-0-foundation.md` | not-started |
| 1  | Backend skeleton — auth + S3 parity + multi-tenant schema | `phase-1-backend-skeleton.md` | not-started |
| 2a | Sync backend slice (`assets` endpoints + tests) | `phase-2-sync-slice.md` (§2a) | not-started |
| 2b | Sync client slice — expo-sqlite + worker + flag (native build) | `phase-2-sync-slice.md` (§2b) | not-started |
| 3a | Sync Inspector + observability | `phase-3-collections-inspector.md` (§3a) | not-started |
| 3b | albums/posts + sync triggers | `phase-3-collections-inspector.md` (§3b) | not-started |
| 4  | Converter + parallel run | `phase-4-converter-parallel.md` | not-started |
| 5a | Cutover — deploy + flip default | `phase-5-cutover.md` (§5a) | not-started |
| 5b | Cleanup — delete old path, retire Rails | `phase-5-cutover.md` (§5b) | not-started |
| 6  | Open registration — signup + hardening | `phase-6-open-registration.md` | not-started |

**Next stage:** 0

## Log

_Newest first. The skill appends one entry per run: what it did, what's pending, any
deviations from the plan._

- _(none yet)_
</content>
