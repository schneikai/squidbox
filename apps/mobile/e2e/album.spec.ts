import type { Page } from 'playwright/test';

import { expect, test } from './fixtures';
import {
  assetCells,
  button,
  cellAssetIds,
  dragCell,
  openTab,
  pickFromSquidbox,
  uniqueName,
  withDialog,
} from './helpers';

// Adds an album named `name` from the Albums tab (its name asked in an alert prompt).
async function createAlbum(page: Page, name: string) {
  await openTab(page, 'Albums');
  await withDialog(
    page,
    (dialog) => dialog.accept(name),
    () => button(page.getByTestId('albums-screen'), 'Add').click(),
  );
  await expect(page.getByTestId('albums-screen').getByText(name, { exact: true })).toBeVisible();
}

// Opens the album and adds the library's first `count` photos to it.
async function addPhotos(page: Page, name: string, count: number) {
  await page.getByTestId('albums-screen').getByText(name, { exact: true }).click();
  const album = page.getByTestId('album-screen');
  await button(album, 'Add').click();
  await pickFromSquidbox(page, count);
  await expect(assetCells(album)).toHaveCount(count);
  return album;
}

test('Add in Albums creates an album with the given name', async ({ page }) => {
  const name = uniqueName('Alpine lakes');

  await createAlbum(page, name);

  const tile = page.getByTestId('albums-screen').getByTestId('album-tile').filter({ hasText: name });
  await expect(tile.getByText('0 Assets', { exact: true })).toBeVisible();
});

test('From Squidbox adds the picked photos to the album', async ({ page }) => {
  const name = uniqueName('Canyon weekend');
  await createAlbum(page, name);

  const album = await addPhotos(page, name, 3);

  // The count leads the line under the name; when the album's photos were last posted follows it.
  await expect(album.getByText(/^3 Assets · /)).toBeVisible();
});

test("dragging a photo onto another's slot reorders the album", async ({ page }) => {
  const name = uniqueName('Summit views');
  await createAlbum(page, name);
  const album = await addPhotos(page, name, 3);
  const cells = assetCells(album);
  await expect.poll(() => cellAssetIds(album)).not.toContain(null);
  const [a, b, c] = await cellAssetIds(album);

  await dragCell(page, cells.nth(0), cells.nth(2));

  // A drop whose click slipped through would open the photo instead.
  await expect(page.getByTestId('asset-screen')).not.toBeVisible();
  await expect.poll(() => cellAssetIds(album)).toEqual([b, c, a]);
});

test("tapping the album's name opens Edit, which saves its name and note together", async ({ page }) => {
  const name = uniqueName('Ridge loop');
  await createAlbum(page, name);
  await page.getByTestId('albums-screen').getByText(name, { exact: true }).click();
  const album = page.getByTestId('album-screen');
  const renamed = uniqueName('Ridge loop at dawn');

  await album.getByRole('heading', { name, exact: true }).click();
  const sheet = page.getByTestId('album-edit-sheet');
  await sheet.getByPlaceholder('Album name').fill(renamed);
  await sheet.getByPlaceholder('Add a note…').fill('Fog until nine');
  await button(sheet, 'Save').click();

  await expect(sheet).toBeHidden();
  await expect(album.getByText(renamed, { exact: true })).toBeVisible();
  await expect(album.getByText('Fog until nine', { exact: true })).toBeVisible();
});
