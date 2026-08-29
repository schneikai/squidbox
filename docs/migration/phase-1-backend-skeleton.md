# Phase 1 — Backend skeleton (auth + S3 asset parity)

## Objective

Stand up the new `apps/server` (Fastify + TS) with the parts that carry over from Rails:
JWT auth (access + rotating refresh) and the S3 asset layer (presigned download URLs,
server-proxied upload incl. multipart, delete) — **multi-tenant-ready in its schema and
storage layout** (see the deviations below), but with **no signup endpoint yet**:
onboarding new users is Phase 6, after the migration. Nothing in Phases 1–5 needs a
second real user; isolation tests use a directly-seeded fixture user. Pointed at the
existing user's **same S3 bucket** and credentials. **Not wired into the app** — the app
still uses Rails.

## Checkpoint (definition of done)

- App is untouched and still runs on Rails (no app changes this phase).
- New server boots locally and passes a smoke test: login with a real user → get
  access/refresh tokens → request a presigned download URL → proxy-upload a small **and** a
  >210 MB file to the shared bucket → delete.
- Auth and asset responses are **byte-compatible** with the client contract (§ parity
  below), so a later phase can point the app at it with no client change.

## Prerequisites

- Phase 0 complete (`packages/shared` + workspaces exist).
- Same AWS credentials/bucket the Rails app uses, from a secure store (not Rails encrypted
  credentials), plus one manually-created **shared multi-tenant bucket** for new users
  (see the storage deviation). A Postgres instance.

## Contract parity (verified against the Rails app — replicate exactly)

**Auth** (`authentication_controller.rb`, `api_controller.rb`):
- JWT: HS256, payload is exactly `{ user_id, exp }` (epoch int), signed with the Rails
  `secret_key_base`. **No `sub`/`iat`/`jti`.** Decode must enforce `algorithm: 'HS256'` and
  401 on expiry. Share the secret so existing tokens validate (or accept a forced re-login).
- `login` → `{ accessToken, refreshToken, user: { id, email } }`. Access exp 24h; refresh =
  random hex, 1y. Rails stores it in a **single column** on the user row (one active
  refresh token, overwritten on rotation). **Deliberate deviation — do NOT replicate the
  single slot.** With one refresh slot, whenever device A rotates, device B's stored
  refresh token dies and B silently falls back to the login screen — background sync on B
  just stops. That's tolerable for backup/restore; it defeats the whole point of
  transparent multi-device sync. Implement a `refresh_tokens` **table** (per-device rows:
  token, user_id, expires_at; rotation replaces only the presented token). The wire
  contract (`login`/`refresh` request + response shapes) is **unchanged**, so the client
  needs no modification — this is server-internal and still "parity" from the app's view.
- `refresh` → `{ accessToken, refreshToken }` only — **no `user`**.
- `logout` (authenticated) → Rails nulls **both** `refresh_token` and
  `refresh_token_expires_at`; with the token table, delete this device's refresh token(s).
  Returns `{ message: 'Logged out successfully' }` (200) or `{ error: 'Not logged in' }` (401).
- Auth extraction is lenient: `Authorization` header `.split(' ').last` **or** `params[:token]`
  — accepts `Bearer <t>`, a bare `<t>`, and `?token=`/body `token`. Do not require a strict
  `Bearer ` prefix.
- **Two error-body shapes:** login/refresh/logout failures return `{ error: "..." }`
  (singular string); the auth middleware returns `{ errors: "..." }` (plural string, not an
  array) for missing/invalid/expired token and user-not-found. All at HTTP 401. Replicate
  both exactly.
- `GET /api/v1/user` → `{ user: { id, email } }`.

**S3 asset endpoints** (`asset_files_controller.rb`, `lib/storage.rb`):
- `download_urls` `{ fileKeys, expiresIn? }` → a **bare array** of `[key, url]` pairs
  `[[key, url], …]` (not an object). Expiry: default 3600s; positive → `min(requested,
  604800)`; non-positive/non-numeric → 3600.
- `upload` (`PUT …/upload/*fileKey`) → `{ "success": true }` (200); on any error **HTTP 422**
  with `{ "success": false, "error": <message> }`.
- `delete_file` `{ fileKey }` → `{ "success": true }` (200); S3 errors → 500 (no rescue).
- Multipart threshold = `MULTIPART_UPLOAD_THRESHOLD = 200.megabytes` = **209,715,200 bytes**
  (200 MiB, binary — ActiveSupport `.megabytes` is 1024-based); part size =
  `100 * 1024 * 1024` = **104,857,600 bytes** (100 MiB). Both binary; match the exact
  constants. `content_length >= threshold` → multipart, else single PUT.
- Objects are private, no `ContentType`/ACL/metadata set anywhere — set none. Rails' layout
  is bucket-per-user (`user.storage_bucket`, region `eu-west-1`); keep honoring that for
  the **existing** account, but do not extend it to new users — see the multi-tenancy
  deviation below. **Never auto-create** buckets.
- `move_file` = copy+delete; `CopySource` must be **URI-encoded** in aws-sdk v3 or keys with
  special chars fail. `head_object` swallows `NotFound` → `{ exists: false }`.

## Multi-tenancy deviations (deliberate — no client contract change)

The target is **isolated multi-tenant** ("just me now, open later" — sync-design §2a).
What lands here is only the part that is **schema-shaped and painful to retrofit** — the
signup *endpoint* itself is deliberately **not** built in this phase (it has no migration
value; it ships in **Phase 6** together with the app's signup screen, per-user quota, and
the deferred hardening list). Two places where copying Rails would bake in single-user
assumptions:

- **Auth data model ready for many users.** The per-device `refresh_tokens` table (parity
  deviation above) and password storage (bcrypt) already accommodate any number of users;
  a second **seeded** user (test fixture, not signup) exercises the isolation checks below.
- **Storage layout: shared bucket + per-user key prefix for new users.** Rails'
  bucket-per-user cannot scale past AWS's ~100-buckets-per-account default (and per-user
  bucket provisioning is operational drag). Instead: one shared multi-tenant bucket
  (created manually — never auto-create), keys namespaced `u/<user_id>/<fileKey>`. A
  per-user **storage resolver** returns `{ bucket, keyPrefix }`: the existing account keeps
  `storage_bucket` = its legacy bucket with an empty prefix (its binaries never move —
  README convention); new users get `storage_bucket = null` → shared bucket +
  `u/<user_id>/` prefix. The server always builds the full key as `keyPrefix + fileKey`
  from the authenticated user — the client keeps sending bare file keys and needs no
  change, and presigned URLs can only ever be minted inside the requester's namespace
  (sync-design §2a).

1. **Scaffold `apps/server`.** Fastify + TS + `fastify-type-provider-zod`. Deps:
   `@squidbox/shared`, `drizzle-orm`, `pg`, `@aws-sdk/client-s3`,
   `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage`, `jsonwebtoken`, `bcrypt`, `zod`.
2. **Config.** Env-based (AWS keys, region, bucket strategy, JWT secret, Postgres URL). No
   Rails-credentials dependency.
3. **DB + users.** Drizzle schema + migration for `users` (email, password_digest,
   `storage_bucket` **nullable** — null means shared bucket + prefix, per the storage
   deviation) and `refresh_tokens` (per-device rows — see the parity deviation above).
   Seed/import your user (with its legacy `storage_bucket`). Create the `change_seq`
   sequence now (used from Phase 2).
4. **Auth** per the parity section (login/refresh/logout/middleware/user, both error shapes,
   lenient extraction). No signup — that's Phase 6. Add a test comparing a Rails-issued vs
   Node-issued token decode.
5. **S3 `Storage` service** per parity: presigned GET/PUT, `head_object`, `move_file`
   (URI-encoded CopySource), `write_file`, `multipart_upload` (100 MiB parts, abort-on-error),
   delete — all routed through the per-user **storage resolver** (`{ bucket, keyPrefix }`),
   with the full key always `keyPrefix + fileKey` derived from the authenticated user.
6. **Streaming upload (aws-sdk v3 pitfall).** A Node `Readable` body to `PutObjectCommand`
   requires `ContentLength`, and default request checksums (CRC32) make the SDK **buffer the
   whole stream**, defeating streaming. Fix: use `@aws-sdk/lib-storage` `Upload` (streams +
   auto-multiparts), or set `ContentLength` and disable added checksums. Verify a >210 MB file
   streams without loading into memory. The manual multipart path reads exactly one part at
   a time (parity with Rails `stream.read(chunk_size)`).
7. **Asset endpoints** per parity (exact response shapes + status codes + casing).
8. **camelCase bridge.** Keep responses camelCase to match the client (`olive_branch`
   equivalent); Zod schemas in `packages/shared` define the contract.
9. **Rate limiting + log hygiene.** Login/refresh are unauthenticated — add per-IP
   throttling on both (signup throttling comes with signup in Phase 6); add an upload
   size/concurrency guard on the streaming proxy (resource amplifier — with multi-tenancy
   make the guard **per-user**, so one tenant's bulk upload can't starve another's).
   Because the client legitimately sends `?token=<JWT>` on uploads (iOS
   background-upload header limitation — see `uploadFileAsync.js`), make sure request
   logging **redacts query strings** on those routes so access tokens don't land in logs.
10. **Smoke test script** exercising login → presign → proxy upload (small + >210 MB) → delete.

## Files created / modified

- **Created:** `apps/server/**` (Fastify app, config, Drizzle schema/migrations, auth,
  Storage, asset routes, rate limiting, smoke test). Shared Zod schemas in `packages/shared`.
- **Modified:** none in `apps/mobile`.

## Native rebuild needed?

No — no app changes.

## Risks & mitigations

- **JWT parity drift** → mirror Rails exactly (HS256, `{user_id,exp}` only); decode test.
- **Streaming upload buffering** (checksum) → `lib-storage` Upload or disable checksums (step 6).
- **Multipart abort correctness** → try/catch aborts the upload on any error.
- **Wrong error shape** → replicate `error` vs `errors` (singular/plural string) + 422 upload.
- **Credential handling** → env/secret manager; never commit.

## Recovery (fix forward)

The app is untouched (still on Rails), so there's nothing to recover app-side. Backend
issues are fixed forward on `apps/server`; it isn't in the app's path yet.

## Verification checklist

- [ ] Server boots; `/up` OK.
- [ ] Smoke test: login → presigned GET → proxy PUT (small + >210 MB) → delete.
- [ ] Login/refresh/logout/user response shapes + casing + both error shapes match Rails.
- [ ] Bearer header, bare token, and `?token=` all authenticate; tokens are redacted from logs.
- [ ] Two devices can hold valid refresh tokens simultaneously; rotating one does not
      invalidate the other (per-device token table).
- [ ] A **seeded** second user works end-to-end (login → presign → upload → download in
      the shared bucket under `u/<user_id>/`).
- [ ] Cross-tenant storage isolation: user B cannot obtain a presigned URL or
      upload/delete for a key in user A's namespace (keys are always prefix-derived from
      the token, never taken raw).
- [ ] Rate limiting active on login + upload guard.
- [ ] App still runs unchanged on Rails.

## Out of scope (later phases)

Sync endpoints, collections, any app wiring, the converter, retiring Rails, and the
signup endpoint/screen/quotas (Phase 6 — only the multi-tenant *schema/storage* readiness
lands here).
</content>
