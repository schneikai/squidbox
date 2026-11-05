/* eslint-env node, browser */
import { expect, test as base } from 'playwright/test';

import { collectErrors, loadAppAsync, signInAsync } from '../scripts/webPreview.mjs';

/**
 * `page`: Playwright's own (a fresh context per test, with the device and trace from the config)
 * with the app loaded, signed in to the mock account unless a test sets
 * `test.use({ signedIn: false })`, as scripts/webPreview.mjs opens it. A test fails on any uncaught
 * error in the page; console errors (failed image loads, dev warnings) are attached to its report.
 */
export const test = base.extend({
  signedIn: [true, { option: true }],
  page: async ({ page, signedIn }, use, testInfo) => {
    if (signedIn) await signInAsync(page.context());
    const { pageErrors, consoleErrors } = collectErrors(page);
    await loadAppAsync(page);

    await use(page);

    if (consoleErrors.length > 0) {
      await testInfo.attach('console errors', { body: consoleErrors.join('\n\n'), contentType: 'text/plain' });
    }
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  },
});

export { expect };
