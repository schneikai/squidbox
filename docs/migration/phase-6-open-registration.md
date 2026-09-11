# Phase 6 — Open registration (archived, not built)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).

## Status

**Not built — not needed.** Squidbox is a private single-user build, so open registration + per-user
quota aren't required. A partial signup endpoint + quota were built and then reverted during the
migration; the codebase carries none of it.

The architecture is already multi-tenant-ready from Phases 1–3 (composite `(user_id, id)` PKs,
per-user advisory lock, token-scoped queries, per-device refresh tokens, shared bucket + per-user
key prefixes, tenant-isolation tests — sync-design §2a). If the app is ever opened to other users,
this phase adds only the front door: a signup endpoint, an app signup screen, and per-user storage
quota.
</content>
