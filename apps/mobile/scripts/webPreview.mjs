/* eslint-env node, browser */
/**
 * Opens the app's web build in Chromium at iPhone 15 Pro Max size, signed in to the local backend,
 * so UI changes can be checked and tested without a phone. Needs `npm run dev:local` running.
 *
 *   npm run web:preview -- [screenshot.png]     # screenshot of the library + console errors
 *
 *   npm run web:preview -- shot.png --production   # release-mode bundle, for performance checks
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

export async function openWebPreview({ signedIn = true, production = false } = {}) {
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext(devices['iPhone 15 Pro Max']);
  if (signedIn) await context.addInitScript(storeTokens, await loginAsync());

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  if (production) await page.route(/\.bundle\?/, serveProductionBundle);

  await page.goto(APP_URL);
  // Exact: "Setting up your library" (the first-sync screen) must not count as the Library tab.
  await page.getByText('Library', { exact: true }).first().waitFor({ timeout: 600_000 });
  return { page, errors, close: () => browser.close() };
}

const SETTLE_MAX_ROUNDS = 10;

// Waits until the screen has loaded its data and thumbnails: grid cells look for their thumbnail
// every 2 s (AssetImage), so wait in rounds of that length until no new image shows up.
export async function settleAsync(page) {
  let imageCount = -1;
  for (let round = 0; round < SETTLE_MAX_ROUNDS; round++) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));
    const count = await page.evaluate(() => document.images.length);
    if (count === imageCount) return;
    imageCount = count;
  }
}

// Metro builds a release bundle (no React dev checks, minified) when asked for one.
function serveProductionBundle(route) {
  const url = new URL(route.request().url());
  url.searchParams.set('dev', 'false');
  url.searchParams.set('minify', 'true');
  return route.continue({ url: url.toString() });
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
  const out = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'web-preview.png';
  const { page, errors, close } = await openWebPreview({ production: process.argv.includes('--production') });
  await settleAsync(page);
  await page.screenshot({ path: out });
  console.log(`Screenshot: ${out}`);
  if (errors.length > 0) console.log(`Console errors:\n${errors.join('\n')}`);
  await close();
}
