/**
 * The local backend as scripts/dev.mjs runs it, for dev.mjs itself and the scripts that drive the
 * app against it (apps/mobile/scripts/webPreview.mjs, the UI flow tests in apps/mobile/e2e): where
 * Metro and the API server answer, the server's folder, settings and environment, the reset of the
 * mock account, and the bundles Metro builds.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { get } from 'node:http';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const METRO_URL = 'http://localhost:8081';
export const SERVER_URL = 'http://localhost:3100';
export const SERVER_DIR = `${ROOT}apps/server`;
export const SERVER_ENV = `${SERVER_DIR}/.env`;

// The server's settings: apps/server/.env over .env.docker, which supplies what an older .env lacks
// (the library-copy account's email, say).
export function readServerEnv() {
  return {
    ...parseEnv(readFileSync(`${SERVER_DIR}/.env.docker`, 'utf8')),
    ...parseEnv(readFileSync(SERVER_ENV, 'utf8')),
  };
}

// `node --env-file` never overrides the shell, so AWS credentials exported there would win over
// MinIO's from apps/server/.env.
export function backendEnv(extra = {}) {
  return { ...withoutKeys(process.env, (key) => key.startsWith('AWS_')), ...extra };
}

export function withoutKeys(env, isExcluded) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !isExcluded(key)));
}

// Resets the mock account to exactly the mock data set (apps/server/scripts/seed-mock.ts), its
// output shown as it goes. `detached` and `onSpawn(child)` let dev.mjs stop it with its other
// children.
export function resetMockDataAsync({ detached = false, onSpawn } = {}) {
  const child = spawn('npm', ['run', 'seed:mock', '--silent'], {
    cwd: SERVER_DIR,
    env: backendEnv(),
    detached,
    stdio: 'inherit',
  });
  onSpawn?.(child);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Resetting the mock data (seed:mock) failed (${code})`)),
    );
  });
}

// Asks Metro for the bundle at `url`, which it builds on its first request (minutes on a cold
// cache), so later requests are cache hits. Throws, with what Metro said, when it can't build it.
// node:http, not fetch: fetch gives up on a response whose headers take over 5 minutes.
export function fetchBundleAsync(url) {
  return new Promise((resolve, reject) => {
    const failed = (reason) => reject(new Error(`Metro couldn't build ${url}: ${reason}`));
    get(url, (res) => {
      if (res.statusCode === 200) {
        res.resume().once('end', resolve);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.once('end', () => failed(`${res.statusCode}\n${body.slice(0, 2000)}`));
    }).once('error', (error) => failed(error.message));
  });
}

// The bundles the web page loads, as the browser would.
export async function buildWebBundleAsync() {
  const html = await (await fetch(`${METRO_URL}/`)).text();
  const bundles = [...html.matchAll(/<script[^>]* src="([^"]+\.bundle[^"]*)"/g)].map(([, src]) =>
    new URL(src.replaceAll('&amp;', '&'), METRO_URL).toString(),
  );
  if (bundles.length === 0) throw new Error(`No bundle in the page at ${METRO_URL}`);
  for (const url of bundles) await fetchBundleAsync(url);
}
