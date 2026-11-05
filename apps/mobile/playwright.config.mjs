/* eslint-env node, browser */
/**
 * The UI flow tests (e2e/*.spec.mjs): the app's web build against the local backend with the mock
 * data, one flow after another, each in a fresh browser context. `npm run test:ui` reuses a running
 * `npm run dev:local -- --web` or starts one (and stops it after the run); CI always starts its own.
 * The device and the browser's proxy are the web preview's (scripts/webPreview.mjs); the e2e
 * fixtures sign in and load the app as it does.
 */
import { defineConfig } from 'playwright/test';

import { launchOptions, PREVIEW_DEVICE } from './scripts/webPreview.mjs';
import { SERVER_URL } from '../../scripts/localBackend.mjs';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  // The flows share one account and one Metro, one after another. A flaky test gets fixed, not
  // retried (no retries is the default).
  workers: 1,
  forbidOnly: isCI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['list'], ['github']] : 'list',
  globalSetup: './e2e/globalSetup.mjs',
  use: {
    ...PREVIEW_DEVICE,
    // The device names WebKit; the preview runs in Chromium.
    browserName: 'chromium',
    launchOptions: launchOptions(),
    // A failed test leaves its trace in test-results/ (`npx playwright show-trace <trace.zip>`).
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ../../scripts/dev.mjs --web',
    // With --web, dev.mjs starts the API server only once the web bundle is built, so it answering
    // means everything is ready.
    url: `${SERVER_URL}/up`,
    // Cold Docker pulls, migrations, Metro's start and the first web bundle.
    timeout: 600_000,
    reuseExistingServer: !isCI,
    // Without it Playwright kills only dev.mjs's process group, and Metro and the API server (each in
    // its own group) outlive the run. dev.mjs stops them on SIGTERM.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    stdout: 'pipe',
  },
});
