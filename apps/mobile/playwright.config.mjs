/* eslint-env node, browser */
/**
 * The UI flow tests (e2e/*.spec.mjs): the app's web build against the local backend with the mock
 * data, one flow after another in one browser per test. `npm run test:ui` reuses a running
 * `npm run dev:local -- --web` or starts one (and stops it after the run); CI always starts its own.
 * The browser, its device and the sign-in come from scripts/webPreview.mjs (the e2e/fixtures app).
 */
import { defineConfig } from 'playwright/test';

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
  outputDir: 'test-results',
  globalSetup: './e2e/globalSetup.mjs',
  webServer: {
    command: 'node ../../scripts/dev.mjs --web',
    // The API server comes up after Metro, so it answering means both are ready.
    url: `${SERVER_URL}/up`,
    // Cold Docker pulls, migrations and Metro's start.
    timeout: 600_000,
    reuseExistingServer: !isCI,
    // Without it Playwright kills only dev.mjs's process group, and Metro and the API server (each in
    // its own group) outlive the run. dev.mjs stops them on SIGTERM.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    stdout: 'pipe',
  },
});
