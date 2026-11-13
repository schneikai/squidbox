/**
 * What the ship and release scripts share (iosApp.mjs, raiseContract.mjs, deployServer.mjs): the git
 * and command helpers, retry with backoff, the "clean and the pushed tip" check and the EAS reads.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The repo's pinned eas-cli (root package.json).
export const eas = fileURLToPath(import.meta.resolve('eas-cli/bin/run'));

/**
 * The checkout must be clean, on a branch, and its HEAD the pushed tip of that branch (fetched
 * first), so whatever names HEAD (the client header, a baseline) can fetch it from origin. Returns
 * the branch and HEAD's full sha; fails with the reason otherwise.
 */
export function requirePushedTip() {
  if (git('status', '--porcelain') !== '') fail('The checkout has changes: commit and push them first.');
  const branch = git('branch', '--show-current');
  if (!branch) fail('Check out a branch (HEAD is detached).');
  const notPushed = () => fail(`HEAD is not the pushed tip of origin/${branch}: push it, or pull, first.`);
  // ls-remote exits 2 when origin has no such branch (never pushed), other codes on an error.
  if (spawnSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch], { stdio: 'ignore' }).status === 2)
    notPushed();
  retry(() => git('fetch', 'origin', branch));
  const commit = git('rev-parse', 'HEAD');
  if (git('rev-parse', `origin/${branch}`) !== commit) notPushed();
  return { branch, commit };
}

/**
 * The latest update published to `channel` (its branch is named after the channel: `eas update
 * --channel` creates it so), with `gitCommitHash` and `createdAt`; none before the first.
 */
export function latestUpdate(channel, cwd, env) {
  const branches = JSON.parse(retry(() => read(eas, ['branch:list', '--json', '--non-interactive'], cwd, env)));
  return branches.find(({ name }) => name === channel)?.updates[0];
}

/** The finished builds `filters` (eas build:list flags) select, newest first, with `gitCommitHash` and `completedAt`. */
export function finishedBuilds(filters, cwd, env) {
  const args = ['build:list', ...filters, '--status', 'finished', '--json', '--non-interactive'];
  return JSON.parse(retry(() => read(eas, args, cwd, env)));
}

// Whether the commit is in this checkout, fetching it once if not.
export function hasCommit(sha) {
  if (!sha) return false;
  if (gitSucceeds('cat-file', '-e', `${sha}^{commit}`)) return true;
  gitSucceeds('fetch', '-q', 'origin', sha);
  return gitSucceeds('cat-file', '-e', `${sha}^{commit}`);
}

export function gitSucceeds(...args) {
  return spawnSync('git', args, { stdio: 'ignore' }).status === 0;
}

export function git(...args) {
  return read('git', args);
}

// A command's captured stdout; its stderr goes to the terminal.
export function read(command, args, cwd, env = process.env) {
  return execFileSync(command, args, { cwd, env, encoding: 'utf8' }).trim();
}

export function run(command, args, cwd, env = process.env) {
  return spawnSync(command, args, { cwd, stdio: 'inherit', env }).status === 0;
}

// Network calls are retried with backoff (2, 4, 8, 16 s) before giving up.
export function retry(action) {
  for (let attempt = 0; ; attempt++) {
    try {
      return action();
    } catch (error) {
      if (attempt === 4) fail(error.message);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * 2 ** attempt);
    }
  }
}

export function fail(message) {
  console.error(message);
  process.exit(1);
}
