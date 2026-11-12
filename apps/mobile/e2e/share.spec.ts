import type { Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { assetCells, button, cellAssetIds, openTab, postCards } from './helpers';

// The browser's share sheet as the flows see it: it can share any files, and each share records
// the files' names and types in `window.shares`.
async function stubWebShare(page: Page) {
  await page.evaluate(() => {
    const shares: { name: string; type: string }[][] = [];
    Object.assign(window, { shares });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        shares.push(files.map(({ name, type }) => ({ name, type })));
      },
    });
  });
  // The full-resolution files the app fetches (presigned URLs), answered with a small body.
  await page.route(
    (url) => url.searchParams.has('X-Amz-Signature'),
    (route) =>
      route.request().resourceType() === 'fetch'
        ? route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'bytes' })
        : route.fallback(),
  );
}

function sharesAsync(page: Page) {
  return page.evaluate(() => (window as unknown as { shares: { name: string; type: string }[][] }).shares);
}

test('Share in select mode shares every picked photo in one share sheet', async ({ page }) => {
  await stubWebShare(page);
  const library = page.getByTestId('library-screen');

  // Two photos found by their thumbnails: the grid's order changes while other tests post.
  await expect.poll(async () => (await cellAssetIds(library)).slice(0, 2)).not.toContain(null);
  const [first, second] = (await cellAssetIds(library)).slice(0, 2);
  const cell = (id: string | null) => assetCells(library).filter({ has: page.locator(`img[src*="${id}thumb"]`) });
  await button(library, 'Select').click();
  for (const id of [first, second]) {
    // Selected, its circle gets a check (one more icon): Share reads the selection it rendered with.
    const icons = cell(id).locator('svg');
    const count = await icons.count();
    await cell(id).click();
    await expect(icons).toHaveCount(count + 1);
  }

  await expect(button(library, 'Post')).toBeVisible();
  await button(library, 'Share').click();

  await expect.poll(() => sharesAsync(page)).toHaveLength(1);
  expect((await sharesAsync(page))[0]).toHaveLength(2);
});

test("the post's menu offers Share", async ({ page }) => {
  await openTab(page, 'Posts');
  await postCards(page.getByTestId('posts-screen')).first().click();

  await button(page.getByTestId('post-screen'), 'Post options').click();

  await expect(page.getByRole('menuitem', { name: 'Share' })).toBeVisible();
});

test("the photo's bar has Share, and its menu still Copy file URL", async ({ page }) => {
  await assetCells(page.getByTestId('library-screen')).first().click();
  const screen = page.getByTestId('asset-screen');

  await expect(button(screen, 'Share')).toBeVisible();
  await button(screen, 'More options').click();
  await expect(page.getByRole('menuitem', { name: 'Copy file URL' })).toBeVisible();
});
