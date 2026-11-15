import { expect, test } from './fixtures';
import { assetCells, button, openTab } from './helpers';

// The assistant's mentions for a post of an album's photo: the contacts on the album's photos (Sam
// Ridge and Theo Park are on a photo of Weekend walks), and the Mentions sheet suggests other
// contacts' handles as one is typed, as the post editor does.
test("a post of an album's photo mentions the album's contacts, and the Mentions sheet suggests handles", async ({
  page,
}) => {
  await openTab(page, 'Albums');
  await page.getByTestId('albums-screen').getByText('Weekend walks', { exact: true }).click();
  await assetCells(page.getByTestId('album-screen')).first().click();
  const asset = page.getByTestId('asset-screen');
  await button(asset, 'More options').click();
  await page.getByRole('menuitem', { name: 'Create post' }).click();
  const editor = page.getByTestId('post-editor');

  const mentions = editor.getByRole('button', { name: /^Mentions / });
  await expect(mentions).toContainText('@ridgeline.bsky.social');
  await expect(mentions).toContainText('@theoparkphoto');

  await mentions.click();
  await page.getByRole('button', { name: 'Add a handle' }).click();
  // The handles already there aren't suggested again.
  const suggestions = page.getByTestId('mention-suggestions');
  await expect(suggestions.getByText('Maya Lindqvist').first()).toBeVisible();
  await expect(suggestions.getByText('Sam Ridge')).toHaveCount(0);
  await page.keyboard.type('lena');
  await button(suggestions, 'Lena Ortiz, @lenaortiz.bsky.social on Bluesky').click();
  await expect(page.getByText('@lenaortiz.bsky.social', { exact: true })).toBeVisible();
});
