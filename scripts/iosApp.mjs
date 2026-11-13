#!/usr/bin/env node
/**
 * Ships the App (EAS preview or production), as a build or as an update, so that no installed code
 * goes without its contract snapshot (docs/sync-design.md §15, ios-build skill → Paths B and C):
 *
 *   1. The checkout must be clean and its commit (X) the pushed tip of its branch.
 *   2. Preflight, read-only, so a refusal leaves no trace: every APP_ENV variable is readable in the
 *      profile's EAS environment, and an update has a finished build with its runtime version (the
 *      native fingerprint) to reach. All refusals are printed at once.
 *   3. Unless X has a snapshot already, `contract:snapshot` writes it; commit it on top (Y) and
 *      push. A failed push stops here, before anything ships.
 *   4. Check out X itself and ship it, so the build or update and its header name X, then return
 *      to the branch. app.config.js refuses an App build or update whose commit has no pushed
 *      snapshot. A build starts on EAS. An update is bundled from the EAS environment alone (never
 *      this shell or .env.local, always from a cleared Metro cache), its source maps go to Sentry,
 *      and only then is it published to the profile's channel: a failed step publishes nothing.
 *
 *   npm run ios:app                     # build, preview
 *   npm run ios:app -- production
 *   npm run ios:update                  # update, preview
 *   npm run ios:update -- production
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// What an App build or update needs from its profile's EAS environment. SQUIDBOX_APP_BUILD is the
// snapshot guard's marker (app.config.js), which an update gets from there only.
const APP_ENV = ['EXPO_PUBLIC_API_URL', 'SENTRY_AUTH_TOKEN', 'SQUIDBOX_APP_BUILD'];

const [command, profile = 'preview'] = process.argv.slice(2);
if (!['build', 'update'].includes(command)) fail(`Unknown command "${command}": build or update.`);
// One value: the EAS build profile, the channel, the EAS environment and EAS_BUILD_PROFILE.
if (!['preview', 'production'].includes(profile)) fail(`Unknown App profile "${profile}": preview or production.`);

const root = git('rev-parse', '--show-toplevel');
const mobileDir = `${root}/apps/mobile`;
const buildsDir = `${root}/apps/server/contract/builds`;
// The repo's pinned eas-cli (root package.json).
const eas = fileURLToPath(import.meta.resolve('eas-cli/bin/run'));
// The env of every eas call but the build: the EAS environment is the only source of the App's
// variables, so neither this shell's EXPO_PUBLIC_* and APP_ENV values nor apps/mobile/.env.local
// can reach the bundle or make the preflight pass.
const easOnlyEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_') && !APP_ENV.includes(name)),
  ),
  EAS_BUILD_PROFILE: profile,
  EXPO_NO_DOTENV: '1',
};

if (git('status', '--porcelain') !== '') fail('The checkout has changes: commit and push them first.');
const branch = git('branch', '--show-current');
if (!branch) fail('Check out the branch to ship (HEAD is detached).');
retry(() => git('fetch', 'origin', branch));
const commit = git('rev-parse', 'HEAD');
if (git('rev-parse', `origin/${branch}`) !== commit) {
  fail(`HEAD is not the pushed tip of origin/${branch}: push it, or pull, first.`);
}

const refusals = [...unreadable(), ...(command === 'update' ? noBuildForRuntime() : [])];
if (refusals.length > 0) fail(refusals.join('\n'));

const short = commit.slice(0, 8);
if (!run('npm', ['run', 'contract:snapshot'], `${root}/apps/server`)) fail('Writing the snapshot failed.');
if (git('status', '--porcelain', '--', buildsDir) !== '') {
  git('add', buildsDir);
  git('commit', '-q', '-m', `Contract snapshot of the App at ${short}`);
  // A push that still fails (the branch moved on) drops the snapshot commit: nothing ships.
  retry(
    () => git('push', '-q', 'origin', `HEAD:${branch}`),
    () => git('reset', '-q', '--hard', commit),
  );
  console.log(`Pushed the contract snapshot of ${short} to ${branch}.`);
}

const subject = git('log', '-1', '--format=%s', commit);
const detach = git('rev-parse', 'HEAD') !== commit;
if (detach) git('checkout', '-q', '--detach', commit);
// Ctrl+C or SIGTERM reaches the running step; this script outlives it to check the branch out again.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {});
const stopped =
  command === 'build'
    ? !run(eas, ['build', '-p', 'ios', '-e', profile, '--non-interactive', '--no-wait'], mobileDir, {
        ...process.env,
        EAS_BUILD_PROFILE: profile,
      }) && 'The EAS build did not start.'
    : shipUpdate();
if (detach) git('checkout', '-q', branch);
if (stopped) fail(stopped);

// Returns what stopped it, if anything.
function shipUpdate() {
  // The iOS bundle with its source maps and asset map, the flags `eas update` passes to
  // `expo export` itself, always from a cleared cache: Metro bakes the EXPO_PUBLIC_* values into its
  // cached transforms (scripts/dev.mjs, metroCacheArgs), so another export's values would ship.
  const bundleAndUpload = [
    'rm -rf dist',
    '(npx expo export --platform ios --output-dir dist --source-maps --dump-assetmap --clear || (echo "Bundling failed." >&2; exit 1))',
    '(npx sentry-expo-upload-sourcemaps dist || (echo "Uploading the source maps to Sentry failed." >&2; exit 1))',
  ].join(' && ');
  if (!run(eas, ['env:exec', profile, bundleAndUpload, '--non-interactive'], mobileDir, easOnlyEnv)) {
    return 'Nothing was published.';
  }
  const publishArgs = [
    ['--channel', profile],
    ['--environment', profile],
    ['--platform', 'ios'],
    ['--skip-bundler'],
    ['--input-dir', 'dist'],
    ['--message', `${short} ${subject}`],
    ['--non-interactive'],
  ].flat();
  if (!run(eas, ['update', ...publishArgs], mobileDir, easOnlyEnv)) return 'Publishing the update failed.';
}

// Each APP_ENV variable must be readable through env:exec, which gets what `eas update
// --environment` gets: plaintext and sensitive variables, not secret ones.
function unreadable() {
  // Prints the name of each one that is unset or empty, never a value.
  const check = `for name in ${APP_ENV.join(' ')}; do [ -n "$(printenv "$name")" ] || echo "$name"; done`;
  const printed = retry(() => read(eas, ['env:exec', profile, check, '--non-interactive'], mobileDir, easOnlyEnv));
  return APP_ENV.filter((name) => printed.split('\n').includes(name)).map(
    (name) =>
      `${name} is not readable in the ${profile} EAS environment: it is missing or secret (ios-build skill → Env vars).`,
  );
}

// An update reaches only the builds with its runtime version.
function noBuildForRuntime() {
  const { runtimeVersion } = JSON.parse(
    read('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'ios'], mobileDir, easOnlyEnv),
  );
  const filters = [
    ['--platform', 'ios'],
    ['--channel', profile],
    ['--runtime-version', runtimeVersion],
    ['--status', 'finished'],
    ['--limit', '1'],
  ].flat();
  const builds = JSON.parse(
    retry(() => read(eas, ['build:list', ...filters, '--json', '--non-interactive'], mobileDir, easOnlyEnv)),
  );
  return builds.length > 0
    ? []
    : [
        `No finished ${profile} build has this native code (runtime ${runtimeVersion}): the update would reach no installed app. Build it with \`npm run ios:app\`.`,
      ];
}

function git(...args) {
  return read('git', args);
}

// A command's captured stdout; its stderr goes to the terminal.
function read(command, args, cwd, env = process.env) {
  return execFileSync(command, args, { cwd, env, encoding: 'utf8' }).trim();
}

function run(command, args, cwd, env = process.env) {
  return spawnSync(command, args, { cwd, stdio: 'inherit', env }).status === 0;
}

// Network calls are retried with backoff (2, 4, 8, 16 s) before giving up.
function retry(action, onFailure = () => {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return action();
    } catch (error) {
      if (attempt === 4) {
        onFailure();
        fail(error.message);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * 2 ** attempt);
    }
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
