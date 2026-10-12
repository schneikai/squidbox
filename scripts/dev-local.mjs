#!/usr/bin/env node
/**
 * Starts the dev client against the local backend with mock data, in one command:
 *   Docker stack (Postgres + MinIO) → migrations + accounts → Metro with Expo's tunnel → API server.
 * Metro serves the API and file storage through its tunnel (apps/mobile/scripts/localBackendProxy.js),
 * so no env file needs the tunnel URL. Ctrl+C stops Metro and the server; the Docker stack
 * keeps running.
 *
 *   npm run dev:local                    # start
 *   npm run dev:local -- --reset-data    # also reset the account to exactly the mock data set
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
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';
// Expo's shared ngrok account occasionally runs out of agent sessions; a later attempt gets one.
const TUNNEL_BUSY = /simultaneous ngrok agent sessions/;
const TUNNEL_ATTEMPTS = 20;

const resetData = process.argv.includes('--reset-data');
const children = new Set();

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (!existsSync(`${MOBILE_DIR}/.env.local`)) {
  fail('apps/mobile/.env.local is missing. Restore it from your password manager (template: .env.local.example).');
}
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

const tunnelUrl = await startMetro();

log('Starting the API server');
const server = start('npm', ['run', 'dev', '--silent'], SERVER_DIR, backendEnv({ S3_PUBLIC_ENDPOINT: tunnelUrl }));
const serverLog = createWriteStream(SERVER_LOG);
server.stdout.pipe(serverLog);
server.stderr.pipe(serverLog);
superviseExit(server);
await waitFor('the API server', async () => (await fetch(`${SERVER_URL}/up`).catch(() => null))?.ok);

if (resetData) {
  log('Resetting the mock data');
  run('npm', ['run', 'seed:mock', '--silent'], SERVER_DIR, backendEnv());
}

console.log(`
  Open in Squidbox (Dev):  ${tunnelUrl}
  Sign in as:              ${serverEnv.SEED_USER_EMAIL} (prefilled)
  Server log:              ${SERVER_LOG}
`);

async function startMetro() {
  for (let attempt = 1; attempt <= TUNNEL_ATTEMPTS; attempt++) {
    log(attempt === 1 ? 'Starting Metro with a tunnel' : `Tunnel busy, retrying (${attempt}/${TUNNEL_ATTEMPTS})`);
    const metro = start('npx', ['expo', 'start', '--tunnel', '--dev-client', '--port', '8081', '--clear'], MOBILE_DIR, {
      ...withoutKeys(process.env, (key) => key === 'CI'), // CI makes Expo skip file watching
      ...proxyEnv(),
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_LOCAL_BACKEND: 'true',
      // In development, .env.local wins over these; leave the login prefill out of it.
      EXPO_PUBLIC_LOGIN_FORM_EMAIL: serverEnv.SEED_USER_EMAIL,
      EXPO_PUBLIC_LOGIN_FORM_PASSWORD: serverEnv.SEED_USER_PASSWORD,
    });
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
    children.delete(metro);
    if (!TUNNEL_BUSY.test(output)) {
      process.stderr.write(output);
      fail('Metro exited before the tunnel was ready');
    }
    await sleep(5000);
  }
  fail('No ngrok session became free; try again in a few minutes');
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

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  return child;
}

// Once a process is up, it should run until Ctrl+C; if it dies, stop everything.
function superviseExit(child) {
  child.once('exit', (code) => {
    if (children.delete(child)) fail(`${child.spawnargs.join(' ')} exited (${code})`);
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
  for (const child of running) child.kill('SIGTERM');
  process.exit(code);
}
