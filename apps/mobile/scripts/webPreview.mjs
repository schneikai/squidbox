/* eslint-env node, browser */
/**
 * Opens the app's web build in Chromium at iPhone 15 Pro Max size, signed in to the local backend,
 * so UI changes can be checked and tested without a phone. Needs `npm run dev:local` running.
 *
 *   npm run web:preview -- [screenshot.png]     # screenshot of the library + console errors
 *
 * Test scripts can drive the page instead:
 *   const { page, errors, close } = await openWebPreview();
 *   await page.getByText('Albums').click();
 *   await settleAsync(page);
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { chromium, devices } from 'playwright';

const APP_URL = 'http://localhost:8081/';
const API_URL = 'http://localhost:3100/api/v1';
const SERVER_ENV = new URL('../../server/.env', import.meta.url);

export async function openWebPreview({ signedIn = true } = {}) {
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext(devices['iPhone 15 Pro Max']);
  if (signedIn) await context.addInitScript(storeTokens, await loginAsync());

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.route(APP_URL, serveCrossOriginIsolated);

  await page.goto(APP_URL);
  await page.getByText('Library').first().waitFor({ timeout: 180_000 });
  return { page, errors, close: () => browser.close() };
}

// Waits until the screen has loaded its data and thumbnails. Grid cells look for their thumbnail
// every 2 s (AssetImage), so give them one round before checking that every image has loaded.
export async function settleAsync(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

// Expo serves the HTML page before Metro's middleware runs, so the page misses the isolation
// headers that metro.config.js adds (expo-sqlite needs SharedArrayBuffer). Add them here.
async function serveCrossOriginIsolated(route) {
  const response = await route.fetch();
  const headers = {
    ...response.headers(),
    'cross-origin-embedder-policy': 'credentialless',
    'cross-origin-opener-policy': 'same-origin',
  };
  await route.fulfill({ response, headers });
}

// The cloud workspace reaches the internet (and Metro's tunnel, where images come from) only through
// its proxy, which takes HTTPS only. Playwright's proxy option would also send http://localhost there.
function launchOptions() {
  const proxy = process.env.HTTPS_PROXY;
  return proxy ? { args: [`--proxy-server=https=${new URL(proxy).host}`] } : {};
}

async function loginAsync() {
  const { SEED_USER_EMAIL: email, SEED_USER_PASSWORD: password } = parseEnv(readFileSync(SERVER_ENV, 'utf8'));
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} (is \`npm run dev:local\` running?)`);
  return res.json();
}

// Runs in the page: the same keys the web token store (apiTokenStore.web.js) reads.
function storeTokens({ accessToken, refreshToken }) {
  const { localStorage } = window;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'web-preview.png';
  const { page, errors, close } = await openWebPreview();
  await settleAsync(page);
  await page.screenshot({ path: out });
  console.log(`Screenshot: ${out}`);
  if (errors.length > 0) console.log(`Console errors:\n${errors.join('\n')}`);
  await close();
}
