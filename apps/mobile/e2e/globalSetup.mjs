/* eslint-env node, browser */
import { spawn } from 'node:child_process';

import { backendEnv, SEED_MOCK, SERVER_DIR } from '../../../scripts/mockData.mjs';
import { APP_URL } from '../scripts/webPreview.mjs';

// Before the UI flow tests, side by side: the mock account reset to exactly the mock data set (what
// `dev:local -- --reset-data` runs), and Metro's web bundle built once, so no test carries the first
// build (minutes on a cold cache) inside its own timeout.
export default async function globalSetup() {
  await Promise.all([resetMockData(), buildWebBundle()]);
}

function resetMockData() {
  return new Promise((resolve, reject) => {
    const seed = spawn(SEED_MOCK.command, SEED_MOCK.args, { cwd: SERVER_DIR, env: backendEnv(), stdio: 'inherit' });
    seed.once('error', reject);
    seed.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm run seed:mock failed (${code})`))));
  });
}

// Asks Metro for the bundles the page loads, as the browser would.
async function buildWebBundle() {
  const html = await (await fetch(APP_URL)).text();
  const bundles = [...html.matchAll(/<script[^>]* src="([^"]+\.bundle[^"]*)"/g)].map(
    ([, src]) => new URL(src.replaceAll('&amp;', '&'), APP_URL),
  );
  if (bundles.length === 0) throw new Error(`No bundle in the page at ${APP_URL}`);
  for (const url of bundles) {
    const res = await fetch(url);
    const body = await res.text();
    if (!res.ok) throw new Error(`Metro couldn't build the web bundle:\n${body.slice(0, 2000)}`);
  }
}
