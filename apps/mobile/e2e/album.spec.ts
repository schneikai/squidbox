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

  // Its asset count sits on the cover; when it was last posted, under its name.
  const tile = page.getByTestId('albums-screen').getByTestId('album-tile').filter({ hasText: name });
  await expect(tile.getByText('0', { exact: true })).toBeVisible();
  await expect(tile.getByText('Never posted', { exact: true })).toBeVisible();
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

test('Starred in Edit album puts the album in the Starred row atop Albums', async ({ page }) => {
  const name = uniqueName('Coastal trail');
  await createAlbum(page, name);
  await page.getByTestId('albums-screen').getByText(name, { exact: true }).click();
  const album = page.getByTestId('album-screen');

  await album.getByRole('heading', { name, exact: true }).click();
  const sheet = page.getByTestId('album-edit-sheet');
  await sheet.getByRole('switch', { name: 'Starred' }).click();
  await button(sheet, 'Save').click();
  await expect(sheet).toBeHidden();
  await page.goBack();

  await expect(page.getByTestId('starred-albums').getByText(name, { exact: true })).toBeVisible();
});

test('the Starred row lists the last starred album first', async ({ page }) => {
  const first = uniqueName('Larch valley');
  const second = uniqueName('Scree gully');
  await createAlbum(page, first);
  await createAlbum(page, second);
  const screen = page.getByTestId('albums-screen');
  const row = page.getByTestId('starred-albums');

  await screen.getByTestId('album-tile').filter({ hasText: second }).dblclick();
  await expect(row.getByText(second, { exact: true })).toBeVisible();
  await screen.getByTestId('album-tile').filter({ hasText: first }).dblclick();

  await expect(row.getByRole('button').first()).toHaveAccessibleName(first);
});

test('Add to Album finds an album by search and adds the photo to it', async ({ page }) => {
  const name = uniqueName('Tarn camp');
  await createAlbum(page, name);
  await openTab(page, 'Library');
  const library = page.getByTestId('library-screen');

  await button(library, 'Select').click();
  await assetCells(library).first().click();
  await button(library, 'Add to album').click();
  const sheet = page.getByTestId('add-to-album-sheet');
  await sheet.getByPlaceholder('Search albums').fill(name);
  await sheet.getByText(name, { exact: true }).click();

  await expect(sheet).toBeHidden();
  await openTab(page, 'Albums');
  await page.getByTestId('albums-screen').getByText(name, { exact: true }).click();
  await expect(page.getByTestId('album-screen').getByText(/^1 Asset · /)).toBeVisible();
});
