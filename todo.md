# TODO — deferred manual gates

Tasks that need a device, secrets, or a deploy and are therefore tracked here instead of
blocking a migration stage's code work. Remove an item once it's verified.

## [x] Stage 1 — Live DB + S3 smoke + isolation (DONE 2026-09-06)

Verified on the local Docker stack (Postgres + MinIO): `npm run smoke` ⇒ SMOKE: PASS and
`npm run verify:isolation` ⇒ ISOLATION: PASS (two-device refresh + cross-tenant isolation).
Re-run locally anytime with `cp .env.docker .env && npm run local:setup && npm run smoke &&
npm run verify:isolation`.

## [ ] Stage 0 — Fresh EAS dev-client build from `apps/mobile/` (non-blocking)

Per the user, this is **not a blocker** (Stage 0 is marked done — the dev client already runs
the new monorepo layout over Metro, verified on device). Kept as a routine follow-up: run one
fresh EAS dev-client build from `apps/mobile/` to confirm EAS builds from the moved layout.

```
eas build --profile development --platform ios --non-interactive   # from apps/mobile/
```
No native modules changed and `runtimeVersion` was not bumped, so it should behave identically.
