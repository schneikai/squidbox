#!/usr/bin/env node
/**
 * Ships the App (EAS preview or production), as a build or as an update (ios-build skill → Paths B
 * and C):
 *
 *   1. Clean and pushed: the checkout must be clean and its commit the pushed tip of its branch, so
 *      the header (which names the commit), the update checks below, the deploy check and the
 *      installed-build suite can fetch it from origin.
 *   2. Preflight, read-only, all refusals at once: every APP_ENV variable is readable in the
 *      profile's EAS environment. An update also needs a finished build on its channel with its
 *      runtime version (the native fingerprint) to reach, the same client migrations as every such
 *      build (a migration ships only with a build, so expo-updates' fallback to the build's embedded
 *      bundle never runs code older than the database), and HEAD must descend from the channel's
 *      latest update (never older code after newer, docs/sync-design.md §15).
 *   3. Ship. A build starts on EAS. An update is bundled from the EAS environment alone (never this
 *      shell or .env.local, always from a cleared Metro cache), its source maps go to Sentry, and
 *      only then is it published to the profile's channel: a failed step publishes nothing.
 *
 *   npm run ios:app                     # build, preview
 *   npm run ios:app -- production
 *   npm run ios:update                  # update, preview
 *   npm run ios:update -- production
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// What an App build or update needs from its profile's EAS environment.
const APP_ENV = ['EXPO_PUBLIC_API_URL', 'SENTRY_AUTH_TOKEN'];
// A change here ships only with a build (see the preflight above).
const MIGRATIONS = 'apps/mobile/src/sync/db/migrations';

const [command, profile = 'preview'] = process.argv.slice(2);
if (!['build', 'update'].includes(command)) fail(`Unknown command "${command}": build or update.`);
// The EAS build profile, also EAS_BUILD_PROFILE.
if (!['preview', 'production'].includes(profile)) fail(`Unknown App profile "${profile}": preview or production.`);

const root = git('rev-parse', '--show-toplevel');
const mobileDir = `${root}/apps/mobile`;
// The profile's channel and EAS environment, as its builds have them.
const { channel, environment } = JSON.parse(readFileSync(`${mobileDir}/eas.json`, 'utf8')).build[profile];
if (!channel || !environment) fail(`eas.json: the ${profile} profile needs a channel and an environment.`);
// The repo's pinned eas-cli (root package.json).
const eas = fileURLToPath(import.meta.resolve('eas-cli/bin/run'));
// The env of every eas call but the build: the EAS environment is the only source of the App's
// variables, so neither this shell's EXPO_PUBLIC_* and APP_ENV values nor apps/mobile/.env.local can
// reach the bundle or make the preflight pass.
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

const refusals =
  command === 'build' ? unreadable(APP_ENV) : [...unreadable(APP_ENV), ...noReachableBuild(), ...olderThanLatest()];
if (refusals.length > 0) fail(refusals.join('\n'));

const short = commit.slice(0, 8);
const subject = git('log', '-1', '--format=%s', commit);
const stopped =
  command === 'build'
    ? !run(eas, ['build', '-p', 'ios', '-e', profile, '--non-interactive', '--no-wait'], mobileDir, {
        ...process.env,
        EAS_BUILD_PROFILE: profile,
      }) && 'The EAS build did not start.'
    : shipUpdate();
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
  if (!run(eas, ['env:exec', environment, bundleAndUpload, '--non-interactive'], mobileDir, easOnlyEnv)) {
    return 'Nothing was published.';
  }
  const publishArgs = [
    ['--channel', channel],
    ['--environment', environment],
    ['--platform', 'ios'],
    ['--skip-bundler'],
    ['--input-dir', 'dist'],
    ['--message', `${short} ${subject}`],
    ['--non-interactive'],
  ].flat();
  if (!run(eas, ['update', ...publishArgs], mobileDir, easOnlyEnv)) return 'Publishing the update failed.';
}

// Each variable must be readable through env:exec, which gets what `eas update --environment`
// gets: plaintext and sensitive variables, not secret ones.
function unreadable(names) {
  // Prints the name of each one that is unset or empty, never a value.
  const check = `for name in ${names.join(' ')}; do [ -n "$(printenv "$name")" ] || echo "$name"; done`;
  let printed;
  try {
    printed = read(eas, ['env:exec', environment, check, '--non-interactive'], mobileDir, easOnlyEnv);
  } catch {
    // With --non-interactive, env:exec swallows its own error: run it again without, to print it.
    run(eas, ['env:exec', environment, check], mobileDir, easOnlyEnv);
    return [`Reading the ${environment} EAS environment failed (above).`];
  }
  return names
    .filter((name) => printed.split('\n').includes(name))
    .map(
      (name) =>
        `${name} is not readable in the ${environment} EAS environment: it is missing or secret (ios-build skill → Env vars).`,
    );
}

// An update reaches only the finished builds on its channel with its runtime version, and must
// carry the client migrations each of them embeds.
function noReachableBuild() {
  let runtimeVersion;
  try {
    ({ runtimeVersion } = JSON.parse(
      read('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'ios'], mobileDir, easOnlyEnv),
    ));
  } catch (error) {
    return [`Resolving the runtime version failed: ${error.message}`];
  }
  const filters = [
    ['--platform', 'ios'],
    ['--channel', channel],
    ['--runtime-version', runtimeVersion],
    ['--status', 'finished'],
    ['--limit', '50'],
  ].flat();
  const builds = JSON.parse(
    retry(() => read(eas, ['build:list', ...filters, '--json', '--non-interactive'], mobileDir, easOnlyEnv)),
  );
  if (builds.length === 0) {
    return [
      `No finished ${profile} build has this native code (runtime ${runtimeVersion}): the update would reach no installed app. Build it with \`npm run ios:app\`.`,
    ];
  }
  return builds
    .filter(
      ({ gitCommitHash }) =>
        !hasCommit(gitCommitHash) || !gitSucceeds('diff', '--quiet', gitCommitHash, 'HEAD', '--', MIGRATIONS),
    )
    .map(
      ({ gitCommitHash }) =>
        `The client migrations differ from those of the ${profile} build of ${String(gitCommitHash).slice(0, 8)} (or its commit is unknown): a migration ships only with a build. Build it with \`npm run ios:app\`.`,
    );
}

// An update never puts older code after newer: X descends from the channel's latest update. Its
// branch is named after the channel (`eas update --channel` creates it so).
function olderThanLatest() {
  const branches = JSON.parse(
    retry(() => read(eas, ['branch:list', '--json', '--non-interactive'], mobileDir, easOnlyEnv)),
  );
  const latest = branches.find(({ name }) => name === channel)?.updates[0];
  if (
    !latest ||
    (hasCommit(latest.gitCommitHash) && gitSucceeds('merge-base', '--is-ancestor', latest.gitCommitHash, 'HEAD'))
  ) {
    return [];
  }
  return [
    `HEAD does not descend from ${String(latest.gitCommitHash).slice(0, 8)}, the commit of the latest ${channel} update (or that commit is unknown): an update never puts older code after newer. Fix forward from a newer commit.`,
  ];
}

// Whether the commit is in this checkout, fetching it once if not.
function hasCommit(sha) {
  if (!sha) return false;
  if (gitSucceeds('cat-file', '-e', `${sha}^{commit}`)) return true;
  gitSucceeds('fetch', '-q', 'origin', sha);
  return gitSucceeds('cat-file', '-e', `${sha}^{commit}`);
}

function gitSucceeds(...args) {
  return spawnSync('git', args, { stdio: 'ignore' }).status === 0;
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
