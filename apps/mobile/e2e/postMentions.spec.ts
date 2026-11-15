import { expect, test } from './fixtures';
import { assetCells, button, openTab, postCards, postText } from './helpers';

// The assistant's mentions for a post of an album's photo: the contacts on the album's photos (Sam
// Ridge and Theo Park are on a photo of Weekend walks), by name, and the Mentions sheet's Add
// suggests other contacts as the post editor does; a pick is the contact's chip, and the next ideas
// are told the names.
test("a post of an album's photo mentions the album's contacts, and the Mentions sheet adds a contact", async ({
  page,
  assistant,
}) => {
  await openTab(page, 'Albums');
  await page.getByTestId('albums-screen').getByText('Weekend walks', { exact: true }).click();
  await assetCells(page.getByTestId('album-screen')).first().click();
  const asset = page.getByTestId('asset-screen');
  await button(asset, 'More options').click();
  await page.getByRole('menuitem', { name: 'Create post' }).click();
  const editor = page.getByTestId('post-editor');

  const mentions = editor.getByRole('button', { name: /^Mentions / });
  await expect(mentions).toContainText('Sam Ridge');
  await expect(mentions).toContainText('Theo Park');

  await mentions.click();
  await page.getByRole('button', { name: 'Add a contact' }).click();
  // The contacts already there aren't suggested again.
  const suggestions = page.getByTestId('mention-suggestions');
  await expect(suggestions.getByText('Maya Lindqvist').first()).toBeVisible();
  await expect(suggestions.getByText('Sam Ridge')).toHaveCount(0);
  await page.keyboard.type('lena');
  await button(suggestions, 'Lena Ortiz, @lenaortiz.bsky.social on Bluesky').click();
  await expect(button(page, 'Remove Lena Ortiz')).toBeVisible();

  // The edit writes the ideas again, told the names.
  await expect
    .poll(() => assistant.chats.at(-1)?.context.mentions)
    .toEqual(expect.arrayContaining(['Lena Ortiz', 'Sam Ridge', 'Theo Park']));
});

// The mock's post that types Sam Ridge's Bluesky handle. Last in this file: it saves the chip into
// that post of the account the flows share, and no flow reads its typed handle.
const TYPED_POST = 'Summer recap, part 1, with';

test("Edit opens an old post with a typed handle as the contact's chip, and Save stores it", async ({ page }) => {
  await openTab(page, 'Posts');
  await postCards(page.getByTestId('posts-screen')).filter({ hasText: TYPED_POST }).first().click();
  const post = page.getByTestId('post-screen');
  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByTestId('post-editor');

  const text = postText(editor);
  await expect(button(text, 'Sam Ridge')).toBeVisible();
  await expect(text).not.toContainText('@ridgeline');
  await expect(button(editor, 'Save')).toBeDisabled();

  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(text).toContainText('Sam Ridge!');
  await button(editor, 'Save').click();
  await expect(editor).toBeHidden();
  await expect(post.getByRole('button', { name: 'Sam Ridge' }).first()).toBeVisible();
});
