/* eslint-env node, browser */
import { expect, test } from './fixtures.mjs';
import {
  assetCells,
  button,
  cellAssetIds,
  dragCell,
  openTab,
  pickFromSquidbox,
  uniqueName,
  withDialog,
} from './helpers.mjs';

// Adds an album named `name` from the Albums tab (its name asked in an alert prompt).
async function createAlbum(page, name) {
  await openTab(page, 'Albums');
  await withDialog(
    page,
    (dialog) => dialog.accept(name),
    () => button(page.getByTestId('albums-screen'), 'Add').click(),
  );
  await expect(page.getByTestId('albums-screen').getByText(name, { exact: true })).toBeVisible();
}

// Opens the album and adds the library's first `count` photos to it.
async function addPhotos(page, name, count) {
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

  await expect(album.getByText('3 Assets', { exact: true })).toBeVisible();
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
