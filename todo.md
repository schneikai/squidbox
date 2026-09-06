# TODO — deferred manual gates

Tasks that need a device, secrets, or a deploy and are therefore tracked here instead of
blocking a migration stage's code work. Remove an item once it's verified.

## [x] Stage 1 — Live DB + S3 smoke + isolation (DONE 2026-09-06)

Verified on the local Docker stack (Postgres + MinIO): `npm run smoke` ⇒ SMOKE: PASS and
`npm run verify:isolation` ⇒ ISOLATION: PASS (two-device refresh + cross-tenant isolation).
Re-run locally anytime with `cp .env.docker .env && npm run local:setup && npm run smoke &&
npm run verify:isolation`.

## [ ] Stage 2b — Device gate: native expo-sqlite + two-device check

**Why:** 2b's sync engine is heavily tested headlessly (24 tests incl. a two-device e2e), but
those use **better-sqlite3**. The real device uses the native **expo-sqlite** module, which is
only exercised on a physical device. This is the one unverified path.

**How:**
1. Fresh dev-client build (native module added; `runtimeVersion` is now `1.0.0`), from
   `apps/mobile`: `eas build --profile development --platform ios --non-interactive`.
2. Run `apps/server` reachable from the phone (LAN IP or tunnel); in the app, set the
   new-backend base URL (dev setting / `apiBaseUrl`) to that address, e.g.
   `http://<LAN-IP>:3100/api/v1`.
3. Log in (new backend), create/favorite/delete an asset, tap Settings→Developer→"Sync now".
4. On a second device signed into the same account, confirm the change appears after a sync.

**Done when:** the app launches on device (SQLite migrates), a create/edit/delete round-trips
A→B, and Settings shows sync status advancing. Then set Stage 2b `done` in STATUS.md.

## [ ] Stage 0 — Fresh EAS dev-client build from `apps/mobile/` (non-blocking)

Per the user, this is **not a blocker** (Stage 0 is marked done — the dev client already runs
the new monorepo layout over Metro, verified on device). Kept as a routine follow-up: run one
fresh EAS dev-client build from `apps/mobile/` to confirm EAS builds from the moved layout.

```
eas build --profile development --platform ios --non-interactive   # from apps/mobile/
```
No native modules changed and `runtimeVersion` was not bumped, so it should behave identically.
