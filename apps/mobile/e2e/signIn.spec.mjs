/* eslint-env node, browser */
import { expect, test } from './fixtures.mjs';
import { assetCells } from './helpers.mjs';
import { readSeedCredentials } from '../scripts/webPreview.mjs';

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test("signing in from Settings opens the account's library", async ({ app: { page } }) => {
    const { email, password } = readSeedCredentials();
    const library = page.getByTestId('library-screen');
    await library.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByTestId('settings-screen');
    await settings.getByPlaceholder('Email').fill(email);
    await settings.getByPlaceholder('Password').fill(password);
    await settings.getByRole('button', { name: 'Sign In', exact: true }).click();

    // The app reopens on the account's library and pulls it before Settings shows again.
    await expect(page.getByTestId('settings-screen').getByText('Signed in as')).toBeVisible({ timeout: 120_000 });
    await page.getByTestId('settings-screen').getByRole('button', { name: 'Back', exact: true }).click();
    await expect(assetCells(page.getByTestId('library-screen')).first()).toBeVisible();
  });
});

test('signing out from Settings shows the sign-in form and keeps the library open', async ({ app: { page } }) => {
  const library = page.getByTestId('library-screen');
  await expect(assetCells(library).first()).toBeVisible();
  await library.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByTestId('settings-screen');
  // No question first: the backup one shows only with media that isn't backed up, and the mock
  // account has none.
  await settings.getByText('Sign out', { exact: true }).click();

  await expect(settings.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(assetCells(page.getByTestId('library-screen')).first()).toBeVisible();
});
