# Phase 0 — Foundation (monorepo + move app + TS/shared scaffold)

## Objective

Convert the repo into an npm-workspaces monorepo, move the Expo app from the repo root
into `apps/mobile`, add the `packages/shared` package and TypeScript tooling — **without
changing any app behavior**. This is the only phase that touches the working app's layout,
so it is done in isolation with nothing else in flight.

**This phase is one atomic PR** (an explicit exception to the small-PR convention): the app
is unbuildable midway through the move, so it must land as a single revertable change.

## Checkpoint (definition of done)

The app builds and runs exactly as before, now from `apps/mobile`:
- `npm install` at root resolves all workspaces.
- Metro starts from `apps/mobile`; the dev client loads over the tunnel.
- Login, browse, and upload work identically (still against Rails).
- A fresh dev-client build from the new path installs and runs (native config unchanged,
  but paths moved — must be re-verified once).

## Prerequisites

- Clean working tree; do this phase on its own branch as a single PR.
- Confirm current facts: Expo SDK 55, npm (`package-lock.json`), `metro.config.js` uses
  `getSentryExpoConfig` + `unstable_enablePackageExports = false`, `@/*` alias via
  `babel-plugin-module-resolver`, app entry `main: node_modules/expo/AppEntry.js`,
  `tunnel.js` hard-codes `join(__dirname, 'node_modules', 'ngrok', 'bin', 'ngrok')`,
  `tunnel.js` + `scripts/check-env.sh` + `.env.local` at root.

## Steps

1. **Create the workspace root.** New root `package.json` with `"private": true`,
   `"workspaces": ["apps/*", "packages/*"]`, and root-level dev tooling only (prettier,
   eslint, typescript). No app runtime deps at root. The single root `package-lock.json` is
   the one EAS will use — keep it committed and in sync.
2. **Move the app into `apps/mobile`.** Move `App.js`, `src/`, `assets/`, `app.config.js`,
   `babel.config.js`, `metro.config.js`, `eas.json`, `tunnel.js`, `scripts/`,
   `.env.local.example`, `.eslintrc.js`, `.nvmrc`, and the app's `package.json` into
   `apps/mobile/`. Keep `.env.local` handling there.
3. **Fix the app entry point (hoisting bug).** `main: "node_modules/expo/AppEntry.js"` is a
   literal path; with workspaces `expo` hoists to the **root** `node_modules`, so that path
   won't exist under `apps/mobile`. Add `apps/mobile/index.js` with `import 'expo/AppEntry';`
   and set `"main": "index.js"` (Metro resolves `expo` via `nodeModulesPaths`).
4. **Pin the `@/*` alias to the app dir (hoisting bug).** `babel-plugin-module-resolver`
   resolves `'@': './src'` relative to `process.cwd()`. If any tool runs babel with cwd =
   repo root, `@` breaks. Set `{ cwd: 'packagejson', alias: { '@': './src' } }` (or
   `cwd: __dirname`) so it always anchors to `apps/mobile`.
5. **Fix `tunnel.js` ngrok path (hoisting bug).** It hard-codes
   `apps/mobile/node_modules/ngrok/bin/ngrok`, but `ngrok` hoists to root. Resolve
   dynamically via `require.resolve('ngrok/bin/ngrok')` (respects hoisting). Also update
   `.env.local`/Metro cwd assumptions in `tunnel.js` and `scripts/check-env.sh`.
6. **Update Metro for monorepo.** In `apps/mobile/metro.config.js`, after
   `getSentryExpoConfig(__dirname)`, set `config.watchFolders = [workspaceRoot]`,
   `config.resolver.nodeModulesPaths = [projectNodeModules, rootNodeModules]`, and keep
   `unstable_enablePackageExports = false`. Follow Expo's "Work with monorepos" guide.
7. **Configure EAS from the subdir.** Keep `eas.json` in `apps/mobile` and run `eas build`
   from there; EAS uploads the **git root** as build context and runs `npm ci` against the
   **root** lockfile. Add a `.easignore` so `apps/server` (created in Phase 1) isn't shipped
   in the mobile build context — **and beware: when `.easignore` exists, EAS uses it
   *instead of* `.gitignore` for upload filtering**, so it must also re-list everything
   `.gitignore` excludes (`.env.local`, `node_modules`, secrets), or those get uploaded
   with the build context. `app.config.js` uses only `./assets/...` relative paths and
   the `EAS_BUILD_PROFILE` bundle-id switch — safe after the move.
8. **Add `packages/shared`.** New package `@squidbox/shared` with `package.json` declaring
   `"main": "index.ts"` (and `"react-native": "index.ts"`) — with `unstable_enablePackageExports=false`
   Metro resolves via `main`/`react-native` and **ignores `exports`**, so an exports-only
   package would fail to resolve. Add `zod` as a dependency here (use bare
   `import { z } from 'zod'`, never subpaths like `zod/v4`, which break with exports off).
   Add it as a workspace dependency of `apps/mobile`. Export a trivial `defineCollection`
   placeholder.
9. **Add TypeScript tooling.** Root `tsconfig.base.json`; `apps/mobile/tsconfig.json`
   extends `expo/tsconfig.base` with `allowJs: true` and `paths` for `@/*` (→ `src/*`) and
   `@squidbox/shared`. Install `typescript` + `@types/react`. **Delete `jsconfig.json`** and
   fold its `baseUrl`/`paths` into `tsconfig.json` (a dir can't have both; the editor
   ignores jsconfig once tsconfig exists). Convert zero app files.
10. **Verify shared resolution with a runtime value import.** Import `defineCollection`
    (a real value, not `import type`) from `@squidbox/shared` somewhere in the app and
    confirm it resolves in the running bundle — a type-only import is erased and proves
    nothing about Metro's runtime resolution.

## Files created / modified

- **Created:** root `package.json`, `tsconfig.base.json`, `.easignore`,
  `apps/mobile/index.js`, `apps/mobile/tsconfig.json`, `packages/shared/*`.
- **Moved:** essentially the whole current tree into `apps/mobile/`.
- **Modified:** `apps/mobile/package.json` (`main`), `babel.config.js` (alias cwd),
  `metro.config.js`, `tunnel.js` (ngrok resolve), `scripts/check-env.sh`, `.gitignore`.
- **Deleted:** `jsconfig.json`.

## Native rebuild needed?

No new native modules, but paths moved — do **one** fresh dev-client build to confirm EAS
builds from the new layout. JS continues to hot-reload over Metro.

## Risks & mitigations

- **npm-workspaces hoisting** breaks the app entry, the `@/*` alias, and the ngrok path →
  steps 3–5 fix each explicitly; these are the three most likely breakages.
- **Metro can't resolve workspace/hoisted deps** → `watchFolders` + `nodeModulesPaths` per
  Expo's guide; keep `unstable_enablePackageExports=false`.
- **`@squidbox/shared` won't resolve** with exports disabled → declare `main`/`react-native`
  entry (step 8), not an `exports` map.
- **EAS build fails from monorepo** → verify root lockfile committed + `.easignore`; test a
  dev build before declaring done.
- **Sentry Metro wrapper interaction** → keep `getSentryExpoConfig` as the base and mutate
  the returned `config`; verify source maps still upload.

## Recovery (fix forward)

Phase 0 always leaves a working, buildable app (the checkpoint). If the monorepo move
surfaces a config problem, fix it forward (patch Metro/EAS/alias/paths) — the app never has
to leave the new layout. No data, backend, or credential changes occur here.

## Verification checklist

- [ ] `npm install` at root OK.
- [ ] `expo start` (from `apps/mobile`) + tunnel serves the bundle.
- [ ] App logs in, browses, uploads (against Rails) — unchanged.
- [ ] Fresh dev-client build installs and runs.
- [ ] Runtime value import from `@squidbox/shared` resolves in the bundle.

## Out of scope (later phases)

Any backend code, any sync code, any real TypeScript conversion of app files, any new
runtime dependency beyond `@squidbox/shared`/`zod` scaffolding.
</content>
