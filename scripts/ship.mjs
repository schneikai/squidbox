/**
 * What the ship and release scripts share (iosApp.mjs, raiseContract.mjs): the git and command
 * helpers, retry with backoff, and the "clean and the pushed tip" check.
 */
import { execFileSync, spawnSync } from 'node:child_process';

/**
 * The checkout must be clean, on a branch, and its HEAD the pushed tip of that branch (fetched
 * first), so whatever names HEAD (the client header, a baseline) can fetch it from origin. Returns
 * the branch and HEAD's full sha; fails with the reason otherwise.
 */
export function requirePushedTip() {
  if (git('status', '--porcelain') !== '') fail('The checkout has changes: commit and push them first.');
  const branch = git('branch', '--show-current');
  if (!branch) fail('Check out a branch (HEAD is detached).');
  retry(() => git('fetch', 'origin', branch));
  const commit = git('rev-parse', 'HEAD');
  if (git('rev-parse', `origin/${branch}`) !== commit) {
    fail(`HEAD is not the pushed tip of origin/${branch}: push it, or pull, first.`);
  }
  return { branch, commit };
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
