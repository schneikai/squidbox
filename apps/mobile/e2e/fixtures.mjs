/* eslint-env node, browser */
import { expect, test as base } from 'playwright/test';

import { openWebPreview } from '../scripts/webPreview.mjs';

/**
 * `app`: the web preview (scripts/webPreview.mjs) in a browser of its own, signed in to the mock
 * account unless a test sets `test.use({ signedIn: false })`. A test fails on any uncaught error in
 * the page; console errors (failed image loads, dev warnings) are attached to its report instead.
 * A failed test leaves a trace in its output folder (`npx playwright show-trace <trace.zip>`):
 * Playwright traces only its own context, and this browser is the preview's.
 */
export const test = base.extend({
  signedIn: [true, { option: true }],
  app: async ({ signedIn }, use, testInfo) => {
    const { page, pageErrors, consoleErrors, close } = await openWebPreview({ signedIn });
    await page.context().tracing.start({ screenshots: true, snapshots: true });

    await use({ page });

    const isFailed = testInfo.status !== testInfo.expectedStatus || pageErrors.length > 0;
    if (isFailed) {
      const path = testInfo.outputPath('trace.zip');
      await page.context().tracing.stop({ path });
      await testInfo.attach('trace', { path, contentType: 'application/zip' });
    } else {
      await page.context().tracing.stop();
    }
    if (consoleErrors.length > 0) {
      await testInfo.attach('console errors', { body: consoleErrors.join('\n\n'), contentType: 'text/plain' });
    }
    await close();
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  },
});

export { expect };
