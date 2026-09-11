# Phase 0 — Foundation (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).

## Objective

Convert the repo into an npm-workspaces monorepo, move the Expo app from the repo root into
`apps/mobile`, add `packages/shared` and TypeScript tooling — without changing app behavior. One
atomic PR (the app is unbuildable mid-move).

## Outcome

Done. Monorepo on branch `phase-0-foundation`; app moved to `apps/mobile/` (renames preserve
history); `packages/shared` (`@squidbox/shared`) added; root workspace + `tsconfig.base.json` +
`.easignore`. Verified: root `npm install` resolves workspaces, a full `expo export` iOS bundle
succeeds, and the dev client loads the new layout over the tunnel on a physical device (login /
browse / upload unchanged).

Notable deviations that stuck: entry point uses `registerRootComponent(App)` +
`import App from './App'` in `apps/mobile/index.js` (plain `import 'expo/AppEntry'` doesn't survive
hoisting); ngrok resolved via `join(require.resolve('ngrok'), '..', 'bin', 'ngrok')`. Package
manager stayed on **npm workspaces** (pnpm declined — its symlink layout fights RN/Metro/EAS).
</content>
