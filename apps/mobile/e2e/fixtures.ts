import type { LoginResponse } from '@squidbox/shared';
import { expect, test as base } from 'playwright/test';

import { collectErrors, loadAppAsync, loginAsync, signInAsync } from '../scripts/webPreview.mjs';

/**
 * `page`: Playwright's own (a fresh context per test, with the device and trace from the config)
 * with the app loaded, signed in to the mock account unless a test sets
 * `test.use({ signedIn: false })`, as scripts/webPreview.mjs opens it. A test fails on any uncaught
 * error in the page; console errors (failed image loads, dev warnings) are attached to its report.
 * The tests share one sign-in per worker (`session`): the server allows 10 sign-ins a minute, and
 * the app refreshes its tokens only on a 401, so a test signing out doesn't end the others'.
 */
export const test = base.extend<{ signedIn: boolean }, { session: LoginResponse }>({
  signedIn: [true, { option: true }],
  // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixtures a fixture uses from it
  session: [async ({}, use) => use(await loginAsync()), { scope: 'worker' }],
  page: async ({ page, signedIn, session }, use, testInfo) => {
    if (signedIn) await signInAsync(page.context(), session);
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
