# TODO — deferred manual gates

Tasks that need a device, secrets, or a deploy and are therefore tracked here instead of
blocking a migration stage's code work. Remove an item once it's verified.

## [ ] Stage 0 — Fresh EAS dev-client build from the new `apps/mobile/` layout

**Why:** Phase 0's verification checklist requires one fresh dev-client build to confirm EAS
builds correctly from the moved monorepo layout (root lockfile + `.easignore`). All other
Stage 0 gates pass (npm install, Metro+tunnel serve the bundle, on-device login/browse/upload
against Rails, `@squidbox/shared` resolves). This is the **last** item before Stage 0 → `done`.

**Blocked on:** not on the device right now; also needs EAS/Apple secrets that aren't set in
this environment (`EXPO_TOKEN`, `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`,
`EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE`, the `.p8`).

**How (run from `apps/mobile/`):**
```
scripts/check-env.sh                 # confirm EAS build env is set
eas build --profile development --platform ios --non-interactive
```
Full runbook: the `cloud-ios-build` skill.

**Done when:**
- [ ] EAS build succeeds from `apps/mobile/` (no lockfile/context/`.easignore` errors).
- [ ] The resulting dev client installs and launches on a physical device.
- [ ] Then: update `docs/migration/STATUS.md` — set Stage 0 to `done`, `Next stage: 1`.

**Note:** no native modules were added and `runtimeVersion` was NOT bumped in Phase 0, so
this build is expected to behave identically to the previous dev client — it only proves the
new layout builds.
