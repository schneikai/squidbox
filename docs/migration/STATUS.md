# Migration Status

Progress tracker for the Rails→TypeScript + sync migration. The `/migrate` skill reads this
to find the next stage, executes it, and updates this file. **One stage per run.**

Statuses: `not-started` · `in-progress` · `blocked-on-user` · `done`

| Stage | Description | Doc | Status |
|-------|-------------|-----|--------|
| 0  | Foundation — monorepo, move app, TS/shared scaffold | `phase-0-foundation.md` | blocked-on-user |
| 1  | Backend skeleton — auth + S3 parity + multi-tenant schema | `phase-1-backend-skeleton.md` | not-started |
| 2a | Sync backend slice (`assets` endpoints + tests) | `phase-2-sync-slice.md` (§2a) | not-started |
| 2b | Sync client slice — expo-sqlite + worker + flag (native build) | `phase-2-sync-slice.md` (§2b) | not-started |
| 3a | Sync Inspector + observability | `phase-3-collections-inspector.md` (§3a) | not-started |
| 3b | albums/posts + sync triggers | `phase-3-collections-inspector.md` (§3b) | not-started |
| 4  | Converter + parallel run | `phase-4-converter-parallel.md` | not-started |
| 5a | Cutover — deploy + flip default | `phase-5-cutover.md` (§5a) | not-started |
| 5b | Cleanup — delete old path, retire Rails | `phase-5-cutover.md` (§5b) | not-started |
| 6  | Open registration — signup + hardening | `phase-6-open-registration.md` | not-started |

**Next stage:** 0 (only the EAS dev-client build gate remains — tracked in `/todo.md`) → then 1

## Log

_Newest first. The skill appends one entry per run: what it did, what's pending, any
deviations from the plan._

- **2026-09-06 — Stage 0: dev-client gate PASSED on device; committed; one gate left.**
  Restored `apps/mobile/.env.local` and booted Metro + ngrok tunnel from the new layout.
  Verified end-to-end: manifest 200, `launchAsset.url` correctly resolves to the monorepo
  path `/apps/mobile/index.bundle`, and the real Hermes bundle builds+serves over the tunnel
  (200). User confirmed on a physical device: **login, browse, and upload all work
  identically against Rails.** Committed the atomic Phase 0 change (see commit below).
  **Remaining:** the fresh EAS dev-client build from `apps/mobile/` — user is off-device and
  EAS/Apple secrets aren't set here, so it's tracked in `/todo.md`. Stage 0 stays
  `blocked-on-user` on that single item; flip to `done` (and Next stage → 1) once the build
  succeeds and installs. Package manager: staying on **npm workspaces** (pnpm considered and
  declined for now — its symlink layout fights RN/Metro/EAS; marginal benefit at this size).

- **2026-08-29 — Stage 0 (Foundation): code complete, blocked-on-user for device/EAS gates.**
  Converted the repo to an npm-workspaces monorepo on branch `phase-0-foundation` (one atomic
  commit). Moved the whole Expo app into `apps/mobile/` (327 tracked renames — history
  preserved), added root workspace `package.json` (dev tooling only: eslint/prettier/typescript)
  + `tsconfig.base.json` + `.easignore`, and created `packages/shared` (`@squidbox/shared`,
  zod dep, `defineCollection` placeholder). Deleted `jsconfig.json` (folded into
  `apps/mobile/tsconfig.json`). Fixed the three hoisting traps + one the plan under-specified.
  - **Verified headlessly (green):** root `npm install` resolves workspaces (`@squidbox/shared`
    symlinked; `expo`/`ngrok` hoisted to root); a full `expo export` iOS bundle succeeds (2157
    modules) — proving Metro monorepo resolution, the `@/` alias, **and** the runtime
    `@squidbox/shared` import in `App.js` all resolve; `tsc` on `packages/shared` passes; eslint
    on changed files = 0 errors.
  - **Deviations from the plan (docs updated in `phase-0-foundation.md`):**
    (1) **Entry point** — plan step 3's `import 'expo/AppEntry'` does **not** survive hoisting:
    `AppEntry.js` does `import App from '../../App'` relative to its own (now root-hoisted)
    location → resolves to repo root, bundle fails. Replaced with the standard
    `registerRootComponent(App)` + `import App from './App'` pattern in `apps/mobile/index.js`.
    (2) **ngrok path** — plan step 5's `require.resolve('ngrok/bin/ngrok')` fails against ngrok's
    `exports` map (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Used `join(require.resolve('ngrok'), '..',
    'bin', 'ngrok')` instead.
    (3) `.gitignore` needed **no** edit — its patterns are non-anchored and already match the
    nested `apps/mobile/` app (`.env.local`, `.expo/`, `node_modules/`). Left `mise.toml` at the
    repo root (plan mentioned a `.nvmrc`, which no longer exists — mise is the repo-wide Node
    toolchain). Also added a "run app commands from `apps/mobile/`" note to `README.md`,
    `AGENTS.md`, and the `cloud-ios-build` skill so the run workflow stays correct.
  - **PENDING — manual gates before Stage 0 can be marked `done` (see next message):**
    a physical-device dev-client run (login/browse/upload against Rails, unchanged) and one
    fresh EAS dev-client build from the new `apps/mobile/` layout. Branch is committed locally,
    not pushed / no PR opened yet (awaiting user).
</content>
