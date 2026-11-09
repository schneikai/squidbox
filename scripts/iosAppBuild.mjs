#!/usr/bin/env node
/**
 * Builds the App (EAS preview or production) so that no installed build goes without its contract
 * snapshot (docs/sync-design.md §15, ios-build skill → Path B):
 *
 *   1. The checkout must be clean and its commit (X) the pushed tip of its branch.
 *   2. Unless X has a snapshot already (a rebuild), write it, commit it on top (Y) and push. A failed
 *      push stops here, before anything is built.
 *   3. Check out X itself and start the EAS build, so the build and its header name X, then return
 *      to the branch. app.config.js refuses an App build whose commit has no pushed snapshot.
 *
 *   npm run ios:app                  # preview
 *   npm run ios:app -- production
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const profile = process.argv[2] ?? 'preview';
if (!['preview', 'production'].includes(profile)) fail(`Unknown App profile "${profile}": preview or production.`);

const root = git('rev-parse', '--show-toplevel');
const buildsDir = `${root}/apps/server/contract/builds`;

if (git('status', '--porcelain') !== '') fail('The checkout has changes: commit and push them first.');
const branch = git('branch', '--show-current');
if (!branch) fail('Check out the branch to build (HEAD is detached).');
retry(() => git('fetch', 'origin', branch));
const commit = git('rev-parse', 'HEAD');
if (git('rev-parse', `origin/${branch}`) !== commit) {
  fail(`HEAD is not the pushed tip of origin/${branch}: push it, or pull, first.`);
}

const short = commit.slice(0, 8);
if (!readdirSync(buildsDir).some((name) => name.endsWith(`-${short}.json`))) {
  if (!run('npm', ['run', 'contract:snapshot'], `${root}/apps/server`)) fail('Writing the snapshot failed.');
  git('add', buildsDir);
  git('commit', '-q', '-m', `Contract snapshot of the build of ${short}`);
  retry(() => git('push', '-q', 'origin', `HEAD:${branch}`));
  console.log(`Pushed the contract snapshot of ${short} to ${branch}.`);
}

git('checkout', '-q', '--detach', commit);
const started = run(
  'npx',
  ['--yes', 'eas-cli', 'build', '-p', 'ios', '-e', profile, '--non-interactive', '--no-wait'],
  `${root}/apps/mobile`,
  {
    EAS_BUILD_PROFILE: profile,
  },
);
git('checkout', '-q', branch);
if (!started) fail('The EAS build did not start.');

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function run(command, args, cwd, env = {}) {
  return spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } }).status === 0;
}

// Network calls are retried with backoff (2, 4, 8, 16 s) before giving up.
function retry(action) {
  for (let attempt = 0; ; attempt++) {
    try {
      return action();
    } catch (error) {
      if (attempt === 4) fail(error.message);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * 2 ** attempt);
    }
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
