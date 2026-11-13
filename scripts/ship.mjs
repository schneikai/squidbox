/**
 * What the ship and release scripts share (iosApp.mjs, raiseContract.mjs, deployServer.mjs): the git
 * and command helpers, retry with backoff, the "clean and the pushed tip" check, the EAS reads and
 * the fly CLI.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
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
  if (
    spawnSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`], { stdio: 'ignore' })
      .status === 2
  )
    notPushed();
  retry(() => git('fetch', 'origin', branch));
  const commit = git('rev-parse', 'HEAD');
  if (git('rev-parse', `origin/${branch}`) !== commit) notPushed();
  return { branch, commit };
}

/** The build profiles of apps/mobile/eas.json, by name. */
export function easProfiles() {
  return JSON.parse(readFileSync(fileURLToPath(new URL('../apps/mobile/eas.json', import.meta.url)), 'utf8')).build;
}

/**
 * The latest update published to each channel, by channel (its branch is named after the channel:
 * `eas update --channel` creates it so), with `gitCommitHash` and `createdAt`; none before the first.
 */
export function latestUpdates(cwd, env) {
  const branches = JSON.parse(retry(() => read(eas, ['branch:list', '--json', '--non-interactive'], cwd, env)));
  return new Map(branches.map(({ name, updates }) => [name, updates[0]]));
}

/**
 * The latest iOS update on `branch` for `runtimeVersion`, with `gitCommitHash`, `createdAt` and
 * `runtimeVersion` (eas update:view); undefined when there is none. The branch must exist.
 */
export function latestUpdateFor(branch, runtimeVersion, cwd, env) {
  const filters = ['--branch', branch, '--runtime-version', runtimeVersion, '--platform', 'ios', '--limit', '1'];
  const list = JSON.parse(retry(() => read(eas, ['update:list', ...filters, '--json', '--non-interactive'], cwd, env)));
  const group = list.currentPage[0]?.group;
  if (!group) return undefined;
  const updates = JSON.parse(retry(() => read(eas, ['update:view', group, '--json', '--non-interactive'], cwd, env)));
  return updates.find(({ platform }) => platform === 'ios');
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

// `fly` or `flyctl` from PATH, else the installer's ~/.fly/bin/flyctl.
export function flyCli() {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const name of ['fly', 'flyctl'])
    for (const dir of dirs) if (isExecutable(join(dir, name))) return join(dir, name);
  return join(homedir(), '.fly/bin/flyctl');
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
