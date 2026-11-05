/* eslint-env node, browser */
import { expect, test } from './fixtures.mjs';
import { assetCells, button, swipeLeft } from './helpers.mjs';

test('a swipe in the pager shows the next photo', async ({ page }) => {
  await assetCells(page.getByTestId('library-screen')).first().click();
  const screen = page.getByTestId('asset-screen');
  const title = screen.getByTestId('toolbar-title');
  // The mock library's photos are a day apart, so the next one has another date.
  const firstTitle = await title.textContent();

  await swipeLeft(page, screen);

  await expect(title).not.toHaveText(firstTitle);
});

test('Favorite in the pager marks the photo as a favorite', async ({ page }) => {
  const library = page.getByTestId('library-screen');
  await assetCells(library).nth(1).click();
  const screen = page.getByTestId('asset-screen');
  const heart = screen.getByRole('button', { name: /^(Favorite|Unfavorite)$/ });
  const flipped = (await heart.getAttribute('aria-label')) === 'Favorite' ? 'Unfavorite' : 'Favorite';

  await heart.click();
  await expect(heart).toHaveAccessibleName(flipped);

  await button(screen, 'Back').click();
  await expect(screen).toBeHidden();
  await assetCells(library).nth(1).click();
  await expect(heart).toHaveAccessibleName(flipped);
});
