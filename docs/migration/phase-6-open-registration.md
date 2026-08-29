# Phase 6 — Open registration (post-migration, own timeline)

## Objective

Open the (already multi-tenant-ready) system to other users: signup endpoint, app signup
screen, and per-user storage quota. This is **not migration work** — Phases 0–5 complete
without it, and nothing in them depends on it. It exists as a phase so "open later"
doesn't decay into scope creep inside the migration or an unplanned afterthought.

The architecture is already in place from Phases 1–3: composite `(user_id, id)` PKs,
per-user advisory lock, token-scoped queries, per-device refresh tokens, shared bucket +
per-user key prefixes, per-user rate/upload guards, tenant-isolation tests (sync-design
§2a). This phase adds only the front door.

## Checkpoint (definition of done)

A new person can install the app, create an account, and use it fully — with zero effect
on existing users' data or sync. The app still builds/ships throughout (the signup screen
is additive UI).

## Prerequisites

- Phase 5b complete (single backend, migration scaffolding gone).
- Decision on the **hardening trigger** honored: the deferred list below ships **before
  the first non-you signup**, not by a calendar date.

## Steps

1. **Signup endpoint.** `POST /api/v1/auth/signup` `{ email, password }` → same response
   shape as `login` (`{ accessToken, refreshToken, user }`); duplicate email → the
   existing auth `{ error: "..." }` shape. bcrypt; basic email-format + password-length
   checks; per-IP signup throttling. New users get `storage_bucket = null` → shared
   bucket + `u/<user_id>/` prefix (the Phase 1 storage resolver — no new storage code).
2. **App signup screen.** Additive UI next to login; no changes to existing flows.
3. **Per-user storage quota.** Cheap enforcement at upload: sum of `fileSize` over the
   user's asset rows vs a per-user limit; reject with a clear error. (Without this, any
   signup can grow your S3 bill unboundedly.)
4. **Deferred hardening (the tracked list, from the Phase 1 deviation):** email
   verification, password reset, abuse/captcha, account deletion + data export. Ship the
   subset demanded by the hardening trigger above; keep the rest tracked.

## Native rebuild needed?

No (UI + backend only), unless unrelated native work rides along.

## Risks & mitigations

- **Abuse of an open endpoint** → throttling + quota land *with* signup, not after;
  hardening trigger gates real opening.
- **Tenant bleed** → no new query surface is added here; the §2a invariant + existing
  isolation tests already cover signup-created users (they're just more seeded users from
  the backend's perspective).

## Out of scope

Cross-user sharing/co-editing of any kind — that is a sync-engine redesign trigger
(sync-design build-vs-adopt note), not a feature to bolt on here.
