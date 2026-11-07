import type { Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { assetCells, button } from './helpers';
import { readSeedCredentials } from '../scripts/webPreview.mjs';

// Opens Settings from the library's account button.
async function openSettings(page: Page) {
  await button(page.getByTestId('library-screen'), 'Settings').click();
  return page.getByTestId('settings-screen');
}

// Back from Settings to the library, which shows its photos.
async function expectLibraryAfterBack(page: Page, settings: Locator) {
  await button(settings, 'Back').click();
  await expect(assetCells(page.getByTestId('library-screen')).first()).toBeVisible();
}

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test("signing in from Settings opens the account's library", async ({ page }) => {
    // The first pull of the account comes on top of the usual test.
    test.slow();
    const { email, password } = readSeedCredentials();
    const settings = await openSettings(page);
    await settings.getByPlaceholder('Email').fill(email);
    await settings.getByPlaceholder('Password').fill(password);
    await button(settings, 'Sign In').click();

    // The app reopens on the account's library and pulls it before Settings shows again.
    await expect(settings.getByText('Signed in as')).toBeVisible({ timeout: 120_000 });
    await expectLibraryAfterBack(page, settings);
  });
});

test('signing out from Settings shows the sign-in form and keeps the library open', async ({ page }) => {
  await expect(assetCells(page.getByTestId('library-screen')).first()).toBeVisible();
  const settings = await openSettings(page);
  // No question first: the backup one shows only with media that isn't backed up, and the mock
  // account has none.
  await settings.getByText('Sign out', { exact: true }).click();

  await expect(button(settings, 'Sign In')).toBeVisible();
  await expectLibraryAfterBack(page, settings);
});
