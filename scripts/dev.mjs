#!/usr/bin/env node
/**
 * Starts the dev client in one command, and Ctrl+C (or SIGTERM) stops everything it started.
 *
 * Local backend with mock data (default):
 *   Docker stack (Postgres + MinIO) → migrations + accounts → Metro with Expo's tunnel → API server.
 *   Metro serves the API and file storage through its tunnel (apps/mobile/scripts/localBackendProxy.js),
 *   so no env file needs the tunnel URL. The Docker stack keeps running after a stop.
 * Live backend (--live): Metro with Expo's tunnel only, against EXPO_PUBLIC_API_URL from .env.local.
 *
 *   npm run dev:local                    # local backend
 *   npm run dev:local -- --reset-data    # also reset the account to exactly the mock data set
 *   npm run dev:local -- --web           # no tunnel: only for the web preview on this machine
 *   npm run dev:live                     # live backend
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

const live = process.argv.includes('--live');
const resetData = process.argv.includes('--reset-data');
const webOnly = process.argv.includes('--web');
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
  const serverEnv = parseEnv(readFileSync(SERVER_ENV, 'utf8'));

  log('Starting Postgres + MinIO');
  run('docker', ['compose', 'up', '-d'], SERVER_DIR);
  await waitFor(
    'Postgres',
    () =>
      spawnSync('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-q'], { cwd: SERVER_DIR }).status === 0,
  );
  run('docker', ['compose', 'wait', 'createbuckets'], SERVER_DIR);
  run('npm', ['run', 'db:setup', '--silent'], SERVER_DIR, backendEnv());

  const metroEnv = {
    EXPO_PUBLIC_LOCAL_BACKEND: 'true',
    // In development, .env.local wins over these; leave the login prefill out of it.
    EXPO_PUBLIC_LOGIN_FORM_EMAIL: serverEnv.SEED_USER_EMAIL,
    EXPO_PUBLIC_LOGIN_FORM_PASSWORD: serverEnv.SEED_USER_PASSWORD,
  };
  const publicUrl = webOnly ? await startMetroLocally(metroEnv) : await startMetroWithTunnel(metroEnv);

  log('Starting the API server');
  const server = start('npm', ['run', 'dev', '--silent'], SERVER_DIR, backendEnv({ S3_PUBLIC_ENDPOINT: publicUrl }));
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
  Sign in as:              ${serverEnv.SEED_USER_EMAIL} (prefilled)
  Server log:              ${SERVER_LOG}
`);
}

// The phone gives up on a bundle that takes a minute to build; build it before handing out the URL.
function prewarmBundle() {
  run('node', ['scripts/prewarmBundle.mjs'], MOBILE_DIR);
}

function startMetro(args, extraEnv) {
  return start('npx', ['expo', 'start', '--dev-client', '--port', '8081', '--clear', ...args], MOBILE_DIR, {
    ...withoutKeys(process.env, (key) => key === 'CI'), // CI makes Expo skip file watching
    ...proxyEnv(),
    EXPO_NO_TELEMETRY: '1',
    ...extraEnv,
  });
}

async function startMetroLocally(extraEnv) {
  log('Starting Metro');
  const metro = startMetro([], extraEnv);
  metro.stdout.pipe(process.stdout);
  metro.stderr.pipe(process.stderr);
  superviseExit(metro);
  await waitFor('Metro', async () => (await fetch(`${METRO_URL}/status`).catch(() => null))?.ok);
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
