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
 *   const { page, pageErrors, consoleErrors, close } = await openWebPreview();
 *   await page.getByText('Albums').click();
 *   await settleAsync(page);
 */
import { chromium, devices } from 'playwright';

import { METRO_URL, readServerEnv, SERVER_URL } from '../../../scripts/localBackend.mjs';

const API_URL = `${SERVER_URL}/api/v1`;
// The phone the preview stands in for.
export const PREVIEW_DEVICE = devices['iPhone 15 Pro Max'];

// A launched browser that fails to sign in or load the app is closed.
export async function openWebPreview({ signedIn = true, production = false } = {}) {
  const browser = await chromium.launch(launchOptions());
  try {
    const context = await browser.newContext(PREVIEW_DEVICE);
    if (signedIn) await signInAsync(context);
    const page = await context.newPage();
    const { pageErrors, consoleErrors } = collectErrors(page);
    if (production) await page.route(/\.bundle\?/, serveProductionBundle);
    await loadAppAsync(page);
    return { page, pageErrors, consoleErrors, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Signs the browser context in to the mock account: every page it opens starts signed in.
export async function signInAsync(context) {
  await context.addInitScript(storeSession, await loginAsync());
}

// Opens the app on `page` and waits for the Library.
export async function loadAppAsync(page) {
  // Metro builds the bundle on the first request, which can take minutes (a release bundle more so).
  await page.goto(`${METRO_URL}/`, { timeout: 600_000 });
  // Exact: "Setting up your library" (the first-sync screen) must not count as the Library tab.
  await page.getByText('Library', { exact: true }).first().waitFor({ timeout: 600_000 });
}

// Uncaught errors and console errors apart, as the page reports them: the UI flow tests fail on the
// first, not the second.
export function collectErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  return { pageErrors, consoleErrors };
}

const SETTLE_MAX_ROUNDS = 10;

// Waits until the screen has loaded its data and thumbnails: the loader fills cells batch by batch,
// so wait in rounds until no new image shows up.
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

// For the scripts: what the page reported, uncaught errors first.
export function printErrors(pageErrors, consoleErrors) {
  if (pageErrors.length > 0) console.log(`Page errors:\n${pageErrors.join('\n')}`);
  if (consoleErrors.length > 0) console.log(`Console errors:\n${consoleErrors.join('\n')}`);
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
export function launchOptions() {
  const proxy = process.env.HTTPS_PROXY;
  return proxy ? { args: [`--proxy-server=https=${new URL(proxy).host}`] } : {};
}

// The mock account's sign-in, from the local backend's settings.
export function readSeedCredentials() {
  const { SEED_USER_EMAIL: email, SEED_USER_PASSWORD: password } = readServerEnv();
  return { email, password };
}

async function loginAsync() {
  const { email, password } = readSeedCredentials();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} (is \`npm run dev:local\` running?)`);
  return res.json();
}

// Runs in the page before every navigation: seeds the session record the web session store
// (sessionStore.js over secureStorage.web.js) reads, once per browser context. A later load must not
// write it again: the app may have rotated the refresh token (the seeded one is then revoked) or a
// test may have deleted the session on purpose. The API lives on the page's origin (apiBaseUrl.js).
function storeSession({ accessToken, refreshToken, user, serverId }) {
  const { localStorage } = window;
  if (localStorage.getItem('webPreviewSeeded')) return;
  localStorage.setItem('webPreviewSeeded', '1');
  const session = {
    serverId,
    userId: user.id,
    email: user.email,
    apiBaseUrl: `${window.location.origin}/api/v1`,
    tokens: { accessToken, refreshToken },
  };
  localStorage.setItem('session', JSON.stringify(session));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'web-preview.png';
  const { page, pageErrors, consoleErrors, close } = await openWebPreview({
    production: process.argv.includes('--production'),
  });
  await settleAsync(page);
  await page.screenshot({ path: out });
  console.log(`Screenshot: ${out}`);
  printErrors(pageErrors, consoleErrors);
  await close();
}
