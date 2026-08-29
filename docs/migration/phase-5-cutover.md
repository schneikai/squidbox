# Phase 5 — Cutover + cleanup

Split into **5a** (deploy + flip default on; verify in production while the old path still
exists) and **5b** (after production confidence, delete the old path and retire Rails). We
**fix forward** — the split exists to prove the new backend in production before deleting the
old data source, not to enable a rollback.

## Objective

Make the new sync path the default, retire the Rails API and the JSON-blob backup endpoints,
and remove the scaffolding (converter, old data path). Continue the opportunistic TS port.

## Phase 5a — cutover (old data still present)

### Definition of done
- App ships with `useNewSync` **on by default**, running fully on the new backend across your
  devices. Rails + the old client data path + old S3 blobs still **exist** (not yet deleted)
  — kept as the data source we verify against and can re-derive from while fixing forward,
  **not** as a rollback target.

### Prerequisites
- Phase 4 gate passed.
- **Server-side consistency check before flipping:** compare per-collection record counts
  (and ideally a checksum) in Postgres against the old JSON blobs — not just on-device
  Inspector counts. This protects against deleting a good data source later.
- New backend deployed and smoke-tested (Phase 1 smoke test + a real login) in a real
  environment.
- **Automated Postgres backups running** (managed-provider backups or a `pg_dump` cron
  with retention, verified restorable once). After 5b the new Postgres is the only
  metadata source; fix-forward without rollback still requires the data to survive —
  today's versioned S3 blobs + `data_backups` snapshots disappear with Rails, and nothing
  in this plan replaces them unless this exists.

### Steps
1. **Deploy the new backend.** Provision Postgres + Fastify (Node 20); AWS + JWT secrets in
   the environment's secret store; point preview/prod `EXPO_PUBLIC_API_URL` at it.
2. **Flip the default.** `useNewSync` default → **on** (env + runtime).
3. **Ship a preview/prod build** (native build required to deliver the flipped default + new
   API URL to non-dev use).

### If something goes wrong (fix forward)
Diagnose and ship a corrective build/deploy **on top** — never revert the app to Rails.
Because the old JSON blobs and Rails data remain untouched through 5a, a data problem is
fixed forward by re-deriving/patching from that retained source into the new backend.

## Phase 5b — cleanup (point of no return)

Only after 5a has run in production long enough to trust the new backend (no unexplained
conflicts; consistency check clean).

### Steps
1. **Remove the old data path (app).** Delete the JSON-blob backup/restore code (`data`,
   `data_backup/*` client wrappers, blob read/write for the 3 JSON files) and the converter
   button. Keep the asset **file** upload/download flow (unchanged — still S3).
2. **Retire Rails.** Decommission the `data`/`data_backup` endpoints. Keep a **read-only
   backup** of the old S3 JSON blobs and Rails `data_backups` rows for a retention window
   (data safety — a source to fix forward from, not a rollback path).
3. **Remove the flag (optional, later).** Delete `useNewSync` + the branching once fully
   confident.
4. **Continue the TS port** opportunistically.

### After 5b
Recovery is still fix-forward: the old app code paths are gone, so a problem is corrected by
patching the new system — using the retained read-only blobs as a source if data needs
re-deriving.

## Native rebuild needed?

5a: yes — a new preview/production build for the flipped default + new API URL. 5b: JS-only
(code deletion).

## Risks & mitigations

- **Prod secret/deploy issues** → validate the deployed backend (smoke test + real login)
  before flipping.
- **Flip gated only on eyeballing** → server-side count/checksum consistency check (5a
  prereq).
- **Deleting a good data source prematurely** → keep old blobs + `data_backups` read-only
  through and beyond 5b; 5b deletes app code paths, not the raw retained data.
- **Preview cert expiry / EAS** → rebuild preview/prod against the new API URL; verify
  Internal Distribution install.

## Verification checklist

- [ ] 5a: new backend deployed; smoke test + real login pass.
- [ ] 5a: automated Postgres backups running and restore verified once.
- [ ] 5a: server-side count/checksum matches old JSON before flipping.
- [ ] 5a: preview/prod build runs fully on the new backend (default on).
- [ ] 5a: assets/albums/posts sync across devices in a non-dev build.
- [ ] 5b (after prod confidence): old data path + converter removed; app still builds and runs.
- [ ] 5b: Rails decommissioned; old blobs retained read-only.

## Out of scope

Future sync upgrades (per-field merge, join-table ordering, APNs push) — tracked
separately. **Opening registration to other users is Phase 6** (signup endpoint + app
screen + per-user quota + the deferred auth-hardening list) — post-migration, on its own
timeline.
</content>
