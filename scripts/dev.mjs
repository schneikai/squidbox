#!/usr/bin/env node
/**
 * Starts the dev client in one command, and Ctrl+C (or SIGTERM) stops everything it started.
 *
 * Local backend with mock data (default):
 *   Docker stack (Postgres + MinIO) → migrations + accounts → Metro with Expo's tunnel → API server.
 *   Metro serves the API and file storage through its tunnel (apps/mobile/scripts/localBackendProxy.js),
 *   so no env file needs the tunnel URL. The Docker stack keeps running after a stop.
 * Live backend: Metro with Expo's tunnel only, against EXPO_PUBLIC_API_URL from .env.local. Only when
 * the owner asks for it (say, to look into a problem in their own account): the dev client always
 * runs against the local backend otherwise.
 *
 *   npm run dev:local                    # local backend
 *   npm run dev:local -- --reset-data    # also reset the account to exactly the mock data set
 *   npm run dev:local -- --web           # no tunnel: only for the web preview on this machine
 *   npm run dev:local -- --clear         # rebuild the bundle from scratch (README → "Dev client")
 *   npm run dev:local -- --live-backend-on-owner-request   # the live backend, on the owner's request only
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseEnv } from 'node:util';

const ROOT = new URL('..', import.meta.url).pathname;
const SERVER_DIR = `${ROOT}apps/server`;
const MOBILE_DIR = `${ROOT}apps/mobile`;
const SERVER_ENV = `${SERVER_DIR}/.env`;
const SERVER_URL = 'http://localhost:3100';
const SERVER_LOG = `${tmpdir()}/squidbox-server.log`;
const METRO_URL = 'http://localhost:8081';
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';
// Expo's shared ngrok account fails now and then (out of agent sessions, dropped connections); a
// later attempt gets through. Expo ends every tunnel error with this hint.
const TUNNEL_FAILED = /Check the Ngrok status page/;
const TUNNEL_ATTEMPTS = 20;
// What Metro's cache was built from, by the last start that got Metro up (see metroCacheArgs).
const METRO_CACHE_KEY = `${ROOT}node_modules/.cache/squidbox-dev/metro-cache-key`;
// This start's key, saved once Metro is up (saveMetroCacheKey).
let metroCacheKey = null;

const live = process.argv.includes('--live-backend-on-owner-request');
const resetData = process.argv.includes('--reset-data');
const webOnly = process.argv.includes('--web');
const clearCache = process.argv.includes('--clear');
const children = new Set();

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (!existsSync(`${MOBILE_DIR}/.env.local`)) {
  run('scripts/write-env-local.sh', [], MOBILE_DIR);
}

if (live) {
  const publicUrl = webOnly ? await startMetroLocally() : await startMetroWithTunnel();
  if (!webOnly) prewarmBundle();
  console.log(`
  ${webOnly ? 'Web preview:            ' : 'Open in Squidbox (Dev): '} ${publicUrl}
  Backend:                 live (EXPO_PUBLIC_API_URL in apps/mobile/.env.local)
`);
} else {
  await startLocalBackendAndMetro();
}

async function startLocalBackendAndMetro() {
  await ensureDocker();
  if (!existsSync(SERVER_ENV)) {
    copyFileSync(`${SERVER_DIR}/.env.docker`, SERVER_ENV);
    log('Created apps/server/.env from .env.docker');
  }
  // The copy of the owner's library has a password of this checkout's own, kept in apps/server/.env.
  if (!parseEnv(readFileSync(SERVER_ENV, 'utf8')).LIBRARY_COPY_PASSWORD) {
    appendFileSync(SERVER_ENV, `\nLIBRARY_COPY_PASSWORD=${randomBytes(18).toString('base64url')}\n`);
  }
  // .env.docker supplies what an older apps/server/.env lacks (the library-copy account's email).
  const serverEnv = {
    ...parseEnv(readFileSync(`${SERVER_DIR}/.env.docker`, 'utf8')),
    ...parseEnv(readFileSync(SERVER_ENV, 'utf8')),
  };
  const copyAccountEnv = {
    LIBRARY_COPY_EMAIL: serverEnv.LIBRARY_COPY_EMAIL,
    LIBRARY_COPY_PASSWORD: serverEnv.LIBRARY_COPY_PASSWORD,
  };

  log('Starting Postgres + MinIO');
  run('docker', ['compose', 'up', '-d'], SERVER_DIR);
  await waitFor(
    'Postgres',
    () =>
      spawnSync('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-q'], { cwd: SERVER_DIR }).status === 0,
  );
  run('docker', ['compose', 'wait', 'createbuckets'], SERVER_DIR);
  run('npm', ['run', 'db:setup', '--silent'], SERVER_DIR, backendEnv(copyAccountEnv));

  const metroEnv = {
    EXPO_PUBLIC_LOCAL_BACKEND: 'true',
    // In development, .env.local wins over these; leave the login prefill out of it.
    EXPO_PUBLIC_LOGIN_FORM_EMAIL: serverEnv.SEED_USER_EMAIL,
    EXPO_PUBLIC_LOGIN_FORM_PASSWORD: serverEnv.SEED_USER_PASSWORD,
    // The one-tap sign-ins in Settings (features/dev-accounts).
    EXPO_PUBLIC_DEV_ACCOUNTS: JSON.stringify([
      { label: 'Mock library', email: serverEnv.SEED_USER_EMAIL, password: serverEnv.SEED_USER_PASSWORD },
      {
        label: 'Copy of my library',
        email: copyAccountEnv.LIBRARY_COPY_EMAIL,
        password: copyAccountEnv.LIBRARY_COPY_PASSWORD,
        isLiveLibraryCopy: true,
      },
    ]),
  };
  const publicUrl = webOnly ? await startMetroLocally(metroEnv) : await startMetroWithTunnel(metroEnv);

  log('Starting the API server');
  // The copy of the owner's library reads the live database (through the cloud workspace's proxy
  // when there is one) and signs read-only URLs for its files (apps/server/src/dev/libraryCopy.ts).
  const server = start(
    'npm',
    ['run', 'dev', '--silent'],
    SERVER_DIR,
    backendEnv({
      S3_PUBLIC_ENDPOINT: publicUrl,
      LIBRARY_COPY_EMAIL: copyAccountEnv.LIBRARY_COPY_EMAIL,
      ...liveLibraryEnv(),
      NODE_USE_ENV_PROXY: '1',
    }),
  );
  const serverLog = createWriteStream(SERVER_LOG);
  server.stdout.pipe(serverLog);
  server.stderr.pipe(serverLog);
  superviseExit(server);
  await waitFor('the API server', async () => (await fetch(`${SERVER_URL}/up`).catch(() => null))?.ok);

  if (!webOnly) prewarmBundle();

  if (resetData) {
    log('Resetting the mock data');
    run('npm', ['run', 'seed:mock', '--silent'], SERVER_DIR, backendEnv());
  }

  console.log(`
  ${webOnly ? 'Web preview:            ' : 'Open in Squidbox (Dev): '} ${publicUrl}
  Sign in as:              ${serverEnv.SEED_USER_EMAIL} (prefilled), or tap an account in Settings
  Server log:              ${SERVER_LOG}
`);
}

// What the copy of the owner's library reads from: the live database and the live bucket, with the
// live server's own DATABASE_URL and AWS keys, read from it through `fly` (or LIVE_DATABASE_URL and
// LIVE_AWS_* from the environment). They stay in the API server's memory, never on disk; the server
// opens the database read-only and signs only GET URLs with the keys. Without them the app still
// runs; opening the copy then says what's missing.
function liveLibraryEnv() {
  // Each live setting under the name the live server knows it by.
  const names = {
    LIVE_DATABASE_URL: 'DATABASE_URL',
    LIVE_AWS_ACCESS_KEY_ID: 'AWS_ACCESS_KEY_ID',
    LIVE_AWS_SECRET_ACCESS_KEY: 'AWS_SECRET_ACCESS_KEY',
    LIVE_AWS_REGION: 'AWS_REGION',
  };
  const live = Object.fromEntries(Object.keys(names).map((key) => [key, process.env[key]]));
  if (Object.values(live).some((value) => !value) && spawnSync('which', ['fly']).status === 0) {
    // Read by name, so a line fly adds can't shift one value into another's place.
    const script = Object.values(names)
      .map((name) => `echo "${name}=$${name}"`)
      .join('; ');
    const { stdout } = spawnSync('fly', ['ssh', 'console', '--app', 'squidbox-server', '-C', `sh -c '${script}'`], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    const found = Object.fromEntries(
      (stdout ?? '')
        .split('\n')
        .map((line) => line.trim().match(/^([A-Z_]+)=(.+)$/))
        .filter(Boolean)
        .map(([, name, value]) => [name, value]),
    );
    for (const [key, name] of Object.entries(names)) live[key] ||= found[name];
  }
  if (!/^postgres(ql)?:\/\//.test(live.LIVE_DATABASE_URL ?? '')) delete live.LIVE_DATABASE_URL;
  if (!live.LIVE_DATABASE_URL || !live.LIVE_AWS_ACCESS_KEY_ID || !live.LIVE_AWS_SECRET_ACCESS_KEY) {
    log("The live server's settings are out of reach (no fly, no LIVE_* variables): the library copy is off");
  }
  return Object.fromEntries(Object.entries(live).filter(([, value]) => value));
}

// The phone gives up on a bundle that takes a minute to build; build it before handing out the URL.
function prewarmBundle() {
  run('node', ['scripts/prewarmBundle.mjs'], MOBILE_DIR);
}

function startMetro(args, extraEnv) {
  const env = {
    ...withoutKeys(process.env, (key) => key === 'CI'), // CI makes Expo skip file watching
    ...proxyEnv(),
    EXPO_NO_TELEMETRY: '1',
    ...extraEnv,
  };
  return start(
    'npx',
    ['expo', 'start', '--dev-client', '--port', '8081', ...metroCacheArgs(env), ...args],
    MOBILE_DIR,
    env,
  );
}

// Metro keeps its cache across starts, so a restart rebuilds only what changed. The EXPO_PUBLIC_*
// values are baked into the cached files, though, so it starts with a cleared cache when they, the
// packages or the Babel and Metro configs changed since the last start, and on --clear. The key is
// saved only once Metro is up, so a start that fails before clearing the cache clears it next time.
function metroCacheArgs(env) {
  const hash = createHash('sha256');
  for (const key of Object.keys(env)
    .filter((each) => each.startsWith('EXPO_PUBLIC_'))
    .sort()) {
    hash.update(`${key}=${env[key]}\n`);
  }
  for (const file of [
    'package-lock.json',
    'apps/mobile/.env.local',
    'apps/mobile/babel.config.js',
    'apps/mobile/metro.config.js',
  ]) {
    hash.update(existsSync(`${ROOT}${file}`) ? readFileSync(`${ROOT}${file}`) : '');
  }
  metroCacheKey = hash.digest('hex');
  const isSame = existsSync(METRO_CACHE_KEY) && readFileSync(METRO_CACHE_KEY, 'utf8') === metroCacheKey;
  return clearCache || !isSame ? ['--clear'] : [];
}

function saveMetroCacheKey() {
  mkdirSync(dirname(METRO_CACHE_KEY), { recursive: true });
  writeFileSync(METRO_CACHE_KEY, metroCacheKey);
}

async function startMetroLocally(extraEnv) {
  log('Starting Metro');
  const metro = startMetro([], extraEnv);
  metro.stdout.pipe(process.stdout);
  metro.stderr.pipe(process.stderr);
  superviseExit(metro);
  await waitFor('Metro', async () => (await fetch(`${METRO_URL}/status`).catch(() => null))?.ok);
  saveMetroCacheKey();
  return METRO_URL;
}

async function startMetroWithTunnel(extraEnv) {
  for (let attempt = 1; attempt <= TUNNEL_ATTEMPTS; attempt++) {
    log(attempt === 1 ? 'Starting Metro with a tunnel' : `Tunnel failed, retrying (${attempt}/${TUNNEL_ATTEMPTS})`);
    const metro = startMetro(['--tunnel'], extraEnv);
    let output = '';
    metro.stdout.on('data', (chunk) => (output += chunk));
    metro.stderr.on('data', (chunk) => (output += chunk));
    const exited = new Promise((resolve) => metro.once('exit', resolve));

    const url = await Promise.race([pollTunnelUrl(metro), exited.then(() => null)]);
    if (url) {
      metro.stdout.removeAllListeners('data').pipe(process.stdout);
      metro.stderr.removeAllListeners('data').pipe(process.stderr);
      superviseExit(metro);
      saveMetroCacheKey();
      return url;
    }
    stop(metro);
    if (!TUNNEL_FAILED.test(output)) {
      process.stderr.write(output);
      fail('Metro exited before the tunnel was ready');
    }
    await sleep(5000);
  }
  fail("Expo's tunnel kept failing; try again in a few minutes, or use --web for the web preview");
}

async function pollTunnelUrl(metro) {
  while (metro.exitCode === null) {
    const res = await fetch(NGROK_API).catch(() => null);
    const url = res?.ok
      ? (await res.json()).tunnels?.find((t) => t.public_url.startsWith('https://'))?.public_url
      : null;
    if (url) return url;
    await sleep(1000);
  }
  return null;
}

// Docker Desktop starts on its own. A cloud container has the daemon installed but not running.
async function ensureDocker() {
  if (dockerIsUp()) return;
  if (spawnSync('which', ['dockerd']).status !== 0) fail('Docker is not running. Start it and try again.');
  log('Starting the Docker daemon');
  spawn('dockerd', [], { detached: true, stdio: 'ignore' }).unref();
  await waitFor('the Docker daemon', dockerIsUp);
}

function dockerIsUp() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

// `node --env-file` never overrides the shell, so AWS credentials exported there would win over
// MinIO's from apps/server/.env.
function backendEnv(extra = {}) {
  return { ...withoutKeys(process.env, (key) => key.startsWith('AWS_')), ...extra };
}

function withoutKeys(env, isExcluded) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !isExcluded(key)));
}

// Expo's tunnel client only honors http_proxy; the cloud workspace sets HTTPS_PROXY.
function proxyEnv() {
  const proxy = process.env.HTTPS_PROXY;
  return proxy ? { http_proxy: proxy, HTTP_PROXY: proxy } : {};
}

async function waitFor(what, check, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) fail(`Timed out waiting for ${what}`);
    await sleep(1000);
  }
}

function run(command, args, cwd, env = process.env) {
  const { status } = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (status !== 0) fail(`${command} ${args.join(' ')} failed`);
}

// Each child leads its own process group, so a stop reaches what npx and npm start under it
// (Metro, Expo's ngrok, the API server), not just the wrapper.
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  return child;
}

// Once a process is up, it should run until Ctrl+C; if it dies, stop everything.
function superviseExit(child) {
  child.once('exit', (code) => {
    if (!children.has(child)) return;
    stop(child); // what it started may still run
    fail(`${child.spawnargs.join(' ')} exited (${code})`);
  });
}

function log(message) {
  console.log(`▸ ${message}`);
}

function fail(message) {
  console.error(`✖ ${message}`);
  shutdown(1);
}

function shutdown(code) {
  const running = [...children];
  children.clear();
  for (const child of running) stop(child);
  process.exit(code);
}

function stop(child) {
  children.delete(child);
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}
