#!/usr/bin/env node
/**
 * Ships the App (EAS preview or production), as a build or as an update, so that no installed code
 * goes without its contract snapshot (docs/sync-design.md §15, ios-build skill → Paths B and C):
 *
 *   1. The checkout must be clean and its commit (X) the pushed tip of its branch.
 *   2. Preflight, read-only, so a refusal leaves no trace: the profile's EAS environment has what
 *      the App needs (APP_ENV), and an update has a finished build with its native code to reach.
 *   3. Unless X has a snapshot already, `contract:snapshot` writes it; commit it on top (Y) and
 *      push. A failed push stops here, before anything ships.
 *   4. Check out X itself and ship it, so the build or update and its header name X, then return
 *      to the branch. app.config.js refuses an App build or update whose commit has no pushed
 *      snapshot. A build starts on EAS; an update is bundled from the EAS environment alone, its
 *      source maps go to Sentry, and only then is it published to the profile's channel.
 *
 *   npm run ios:app                     # build, preview
 *   npm run ios:app -- production
 *   npm run ios:update                  # update, preview
 *   npm run ios:update -- production
 *   node scripts/iosApp.mjs bundle      # the update's bundle alone, of the checkout as it is, in apps/mobile/dist
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// What an App build or update needs from its profile's EAS environment.
const APP_ENV = ['EXPO_PUBLIC_API_URL', 'SENTRY_AUTH_TOKEN'];
const EAS = ['--yes', 'eas-cli'];

const [command, profile = 'preview'] = process.argv.slice(2);
if (!['build', 'update', 'bundle'].includes(command)) fail(`Unknown command "${command}": build, update or bundle.`);
// One value: the EAS build profile, the channel, the EAS environment and EAS_BUILD_PROFILE.
if (!['preview', 'production'].includes(profile)) fail(`Unknown App profile "${profile}": preview or production.`);

const root = git('rev-parse', '--show-toplevel');
const mobileDir = `${root}/apps/mobile`;
const buildsDir = `${root}/apps/server/contract/builds`;

if (command === 'bundle') {
  if (!bundle(updateEnv())) fail('Bundling failed.');
  console.log(`The bundle is in ${mobileDir}/dist.`);
  process.exit(0);
}

if (git('status', '--porcelain') !== '') fail('The checkout has changes: commit and push them first.');
const branch = git('branch', '--show-current');
if (!branch) fail('Check out the branch to ship (HEAD is detached).');
retry(() => git('fetch', 'origin', branch));
const commit = git('rev-parse', 'HEAD');
if (git('rev-parse', `origin/${branch}`) !== commit) {
  fail(`HEAD is not the pushed tip of origin/${branch}: push it, or pull, first.`);
}

const refusals = command === 'build' ? missingFromEas() : [...unreadableByUpdate(), ...noBuildForRuntime()];
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
const stopped = command === 'build' ? shipBuild() : shipUpdate();
if (detach) git('checkout', '-q', branch);
if (stopped) fail(stopped);

// Returns what stopped it, if anything.
function shipBuild() {
  const started = run(
    'npx',
    [...EAS, 'build', '-p', 'ios', '-e', profile, '--non-interactive', '--no-wait'],
    mobileDir,
    {
      ...process.env,
      EAS_BUILD_PROFILE: profile,
    },
  );
  return started ? undefined : 'The EAS build did not start.';
}

// Each step runs only if the one before succeeded: nothing is published until the last. Returns
// what stopped it, if anything.
function shipUpdate() {
  const env = { ...updateEnv(), SQUIDBOX_APP_BUILD: '1' };
  const steps = [
    ['Bundling', () => bundle(env)],
    ['Uploading the source maps to Sentry', () => easExec('npx sentry-expo-upload-sourcemaps dist', env)],
    [
      'Publishing',
      () =>
        run(
          'npx',
          [
            ...EAS,
            'update',
            '--channel',
            profile,
            '--environment',
            profile,
            '--platform',
            'ios',
            '--skip-bundler',
            '--input-dir',
            'dist',
            '--message',
            `${short} ${subject}`,
            '--non-interactive',
          ],
          mobileDir,
          env,
        ),
    ],
  ];
  const failed = steps.find(([, step]) => !step());
  return failed && `${failed[0]} stopped the update: nothing after it ran.`;
}

// The update's iOS bundle in apps/mobile/dist, with its source maps and asset map, the flags
// `eas update` passes to `expo export` itself. Always from a cleared cache: Metro bakes the
// EXPO_PUBLIC_* values into its cached transforms (scripts/dev.mjs, metroCacheArgs), so another
// export's values would ship.
function bundle(env) {
  rmSync(`${mobileDir}/dist`, { recursive: true, force: true });
  return easExec('npx expo export --platform ios --output-dir dist --source-maps --dump-assetmap --clear', env);
}

// Runs a command with the profile's plaintext and sensitive EAS variables (not its secret ones),
// as `eas update --environment` gets them.
function easExec(bashCommand, env) {
  return run('npx', [...EAS, 'env:exec', profile, bashCommand, '--non-interactive'], mobileDir, env);
}

// The env of every step of an update: the EAS environment is its only source, so neither this
// shell's EXPO_PUBLIC_* and APP_ENV values nor apps/mobile/.env.local can reach the bundle or make
// the preflight pass.
function updateEnv() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_') && !APP_ENV.includes(name)),
  );
  return { ...env, EAS_BUILD_PROFILE: profile, EXPO_NO_DOTENV: '1' };
}

// A build on the EAS worker gets every variable of the environment, secret ones too: they must exist.
function missingFromEas() {
  // Lines of NAME=value; only the names are read, no value is printed.
  const listed = retry(() => read('npx', [...EAS, 'env:list', profile, '--format', 'short'], mobileDir, updateEnv()));
  const names = new Set(listed.split('\n').map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').split('=')[0]));
  return APP_ENV.filter((name) => !names.has(name)).map(
    (name) => `${name} is not set in the ${profile} EAS environment (ios-build skill → Env vars).`,
  );
}

// An update gets only the plaintext and sensitive variables: each must be readable through env:exec.
function unreadableByUpdate() {
  // Prints the name of each one that is unset or empty, never a value.
  const check = `for name in ${APP_ENV.join(' ')}; do [ -n "$(printenv "$name")" ] || echo "$name"; done`;
  const printed = retry(() =>
    read('npx', [...EAS, 'env:exec', profile, check, '--non-interactive'], mobileDir, updateEnv()),
  );
  return APP_ENV.filter((name) => printed.split('\n').includes(name)).map(
    (name) =>
      `${name} is not readable by an update in the ${profile} EAS environment (a secret variable is not: recreate it as sensitive, ios-build skill → Env vars).`,
  );
}

// An update reaches only the builds with its runtime version (the native fingerprint).
function noBuildForRuntime() {
  const env = updateEnv();
  const { runtimeVersion } = JSON.parse(
    read('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'ios'], mobileDir, env),
  );
  const builds = JSON.parse(
    retry(() =>
      read(
        'npx',
        [
          ...EAS,
          'build:list',
          '--platform',
          'ios',
          '--channel',
          profile,
          '--runtime-version',
          runtimeVersion,
          '--status',
          'finished',
          '--limit',
          '1',
          '--json',
          '--non-interactive',
        ],
        mobileDir,
        env,
      ),
    ),
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
