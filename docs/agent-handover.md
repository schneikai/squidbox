# Agent handover

This repo is maintained by Claude Code agents working with the owner (Kai): maintenance, bug fixes and
new features for the Squidbox iOS app and its backend. This page is the starting point for a new
session. It points to where things live and covers what isn't obvious from the code.

## Read first

| What | Where |
|---|---|
| Coding rules, conventions, build invariants | `AGENTS.md` (always follow it) |
| Setup, env files, builds, dev client, local backend, web preview | `README.md` |
| Open work, ideas, owner-only steps | `todo.md`, the single list. Add an entry when you find something you won't fix now, and remove it in the same commit that does the work |
| How sync works: per-field merge, restores vs purges, the device-library merge model | `docs/sync-design.md` (§8 = the merge model and what's left open) |
| Device library vs account libraries, sign-in and sign-out | `docs/library-ownership-plan.md` |
| Runbooks | Skills in `.claude/skills/`: `build` (iOS builds), `deploy-server` (Fly + Neon), `legacy-import` |
| DB backups | `docs/ops/db-backup.md` |

## How the owner likes to work

- Answers short and friendly, for a non-technical reader. Numbered lists when the owner should pick
  per item.
- Work autonomously once asked. Push to `main`.
- Clean, DRY, root-cause fixes. Reuse existing components and design tokens. One solution for iOS and web.
- Never silently leave data out. Behaviour must be intuitive.
- Delegate to subagents, all on Opus. After every round, run the official `/simplify` and
  `/code-review` skills. For risky areas (sync), also run an adversarial tester agent that writes
  `it.fails` tests for each bug it finds. A fix agent then turns them into passing tests. Repeat
  until a round is clean.
- The owner tests in the dev client or the preview build and reports bugs. Don't add "check this"
  items to `todo.md`.
- Ask before production server deploys. The server always ships before an app build that depends
  on it.

## Secrets: never print, never commit

A fresh cloud session has none of these. Ask the owner to restore them from their password manager,
or to store them as environment secrets in the cloud environment settings:

- `apps/mobile/.env.local` (dev client; template `.env.local.example`). Without it, don't start
  Metro (AGENTS.md).
- `EXPO_TOKEN`, plus the App Store Connect key: the `.p8` file, `EXPO_ASC_KEY_ID`,
  `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`. Routine builds only
  need `EXPO_TOKEN`; the rest is for credential repair. Never use an Apple ID or password from the
  cloud.
- A Fly.io token for deploys (`fly auth login` needs a browser; a `FLY_API_TOKEN` works headless).
- `apps/server/.env` (AWS keys for the legacy import). Never echo its values. Never read the
  production DB.

Keep secrets outside the repo, e.g. a scratch `env.sh` you source. Refer to variable names only.

## Cloud workspace gotchas

- **Docker** (Postgres for `test:db` / `test:e2e`) doesn't survive a container restart. Remove the
  stale pid files (`/var/run/docker.pid` and containerd's), start
  `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt nohup dockerd &` and wait for `docker info`. The compose
  containers start on their own.
- **Server deploy:** Fly's Depot builder can't pass the workspace proxy. Build the image locally and
  `fly deploy --image …`; the `deploy-server` skill has the exact steps. Verify with
  `curl https://squidbox-server.fly.dev/up`.
- **Dev client tunnel:** from `apps/mobile/`, run
  `env -u CI http_proxy=$HTTPS_PROXY npx expo start --tunnel --dev-client` in the background (needs
  `npm i -g @expo/ngrok@^4.1.0` once). `CI` must be unset, not empty. Read the URL from
  `curl -s localhost:4040/api/tunnels` (`https://<id>-anonymous-8081.exp.direct`), check
  `<url>/status` returns 200, and give the owner only that URL. `tunnel.js` (ngrok free plan) doesn't
  work behind the proxy.
- **iOS builds:** `EAS_BUILD_PROFILE=<preview|development> npx eas-cli build -p ios -e <profile>
  --non-interactive --no-wait`, then poll about every 5 minutes. Hand over the build page URL plus a
  QR code (see the `build` skill).
- **Worktrees:** subagents work in `.claude/worktrees/<name>` with `node_modules` symlinked. Never run
  `npm install` / `expo install` inside a worktree; it once pruned the shared `node_modules`. Fix:
  `npm install` at the repo root. `node_modules` is in `.git/info/exclude` so the symlinks don't
  show as untracked.
- A container restart stops background tasks and agents. Re-launch them, and check the worktree for
  half-done edits first.

## Checks before pushing

From the repo root: `npm run lint`, `npm run typecheck`, `npm run knip` (keep it clean).
`apps/mobile`: `npm test`, plus `npm run test:e2e` with Postgres. `apps/server`: `npm test`, plus
`npm run test:db` with Postgres. CI runs lint, tests and knip.

`apps/mobile/test/mainClient.e2e.test.ts` runs the installed app's real client code (pinned commit
`INSTALLED`) against the current server, so old installs keep working.

## State at handover (2026-10-23)

- `main` has the per-field sync merge (merge commit `b972efb`). Server deployed from it (Fly release v6).
- Preview build `7ca9aa9f-5860-4bea-882b-d3e93be93435` and dev-client build
  `7ff795b7-2a32-4813-97d0-8745f5fcd60b` contain it and the haptics module.
- **Once the owner has installed that preview build** (see `todo.md`):
  - delete `resolveOwners` and `backfillMergeMarkers`, including the bare-id fallback in
    `getMergeTarget`;
  - bump `INSTALLED` in `mainClient.e2e.test.ts` to the new build's commit.
- Known, accepted sync limitations are listed in `docs/sync-design.md` §8 ("Left open") and in
  `todo.md`. For example, a row the server keeps rejecting holds a finished device-library merge
  parked.
