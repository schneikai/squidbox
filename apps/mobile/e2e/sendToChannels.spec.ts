import type { BrowserContext, Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { allowClipboard, button, clipboard, openPost, postCards, postText, withDialog } from './helpers';

// The mock post that mentions Sam Ridge by chip, with a sent Bluesky copy of his own, an unsent
// Instagram one that shows the post (Sam has no Instagram handle) and an untouched X card.
const CHIP_POST = 'Lost in the forest for a day with';

test.beforeEach(async ({ context }: { context: BrowserContext }) => {
  await allowClipboard(context);
});

// Opens the post with `text` from the posts list (the newest of them), then its ⋯ menu's `item`.
async function fromPostMenu(page: Page, text: string, item: string) {
  const post = await openPost(page, text);
  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  return post;
}

// His channels, in his order: every post has a card for each.
const CHANNELS = ['Bluesky', 'X', 'Instagram'];

const sendSheet = (page: Page) => page.getByTestId('send-to-channels-sheet');
const copyCard = (sheet: Locator, channel: string) => sheet.getByLabel(`${channel} copy`, { exact: true });

test("a post card's copy icon asks for which channel, names a contact without a handle there, and copies the chip as the contact's handle", async ({
  page,
}) => {
  await button(await openPost(page, CHIP_POST), 'Copy text').click();
  await expect(page.getByText('No handle', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Bluesky', exact: false }).first().click();

  await expect.poll(() => clipboard(page)).toBe('Lost in the forest for a day with @ridgeline.bsky.social 🌲');
});

test('a tap on a copy opens it as it goes out, and its copy icon copies for its channel without asking', async ({
  page,
}) => {
  await fromPostMenu(page, CHIP_POST, 'Send to channels');
  await copyCard(sendSheet(page), 'Bluesky').getByText('Bluesky', { exact: true }).click();
  const copy = page.getByTestId('channel-copy-screen');
  await expect(copy.getByText('@ridgeline.bsky.social')).toBeVisible();
  // The copy's first post's icon.
  await button(copy, 'Copy text').first().click();

  await expect
    .poll(() => clipboard(page))
    .toBe('A whole day under the trees with @ridgeline.bsky.social. Best shots below 🌲');
});

test('the sheet opens with a card per channel filled from the post, and Send all marks them all sent', async ({
  page,
}) => {
  await fromPostMenu(page, 'Coffee and a view', 'Send to channels');
  const sheet = sendSheet(page);
  for (const channel of CHANNELS)
    await expect(copyCard(sheet, channel).getByText('Coffee and a view. That is all.')).toBeVisible();
  await expect(button(sheet, 'Add channel')).toBeHidden();

  await button(sheet, 'Send all').click();
  for (const channel of CHANNELS) await expect(copyCard(sheet, channel).getByText(/^Sent /)).toBeVisible();
  await expect(button(sheet, 'Send all')).toBeHidden();
});

test("Remove takes a channel's card away for good, and Add channel brings it back", async ({ page }) => {
  const post = await fromPostMenu(page, 'First light over the hills', 'Send to channels');
  const sheet = sendSheet(page);
  await button(copyCard(sheet, 'X'), 'X copy options').click();
  await withDialog(
    page,
    (dialog) => dialog.accept(),
    () => page.getByRole('menuitem', { name: 'Remove' }).click(),
  );
  await expect(copyCard(sheet, 'X')).toBeHidden();
  await button(sheet, 'Close').click();
  await expect(sheet).toBeHidden();

  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: 'Send to channels', exact: true }).click();
  await expect(copyCard(sheet, 'Bluesky')).toBeVisible();
  await expect(copyCard(sheet, 'X')).toBeHidden();
  await button(sheet, 'Add channel').click();
  await page.getByRole('menuitem', { name: 'X', exact: true }).click();

  await expect(button(copyCard(sheet, 'X'), 'Send now')).toBeVisible();
  await expect(button(sheet, 'Add channel')).toBeHidden();
});

test("Edit on an untouched card saves it as the channel's own copy", async ({ page }) => {
  await fromPostMenu(page, 'First light over the hills', 'Send to channels');
  const card = copyCard(sendSheet(page), 'Bluesky');
  await button(card, 'Edit').click();
  const editor = page.getByTestId('channel-copy-editor');
  await expect(button(editor, 'Save')).toBeDisabled();
  await postText(editor).fill('First light, just for Bluesky');
  await button(editor, 'Save').click();

  await expect(editor).toBeHidden();
  await expect(card.getByText('First light, just for Bluesky')).toBeVisible();
});

test("Use on an idea in a copy's composer puts in the chip of a name the idea marks", async ({ page, assistant }) => {
  assistant.chatAnswer = () => ({ reply: '', postOptions: ['Back in the forest with @[Sam Ridge]'] });
  await fromPostMenu(page, CHIP_POST, 'Send to channels');
  await button(copyCard(sendSheet(page), 'X'), 'Edit').click();
  const editor = page.getByTestId('channel-copy-editor');
  await button(editor, 'Post ideas').click();
  await button(editor, 'Use').click();

  await expect(button(postText(editor), 'Sam Ridge')).toBeVisible();
  // A chip, so the copy says Sam has no X handle.
  await expect(editor.getByText('Sam Ridge has no X handle')).toBeVisible();
  await withDialog(
    page,
    (dialog) => dialog.accept(),
    () => button(editor, 'Back').click(),
  );
});

test("an idea in a copy's composer reads its chip as the contact's handle on that channel", async ({
  page,
  assistant,
}) => {
  assistant.chatAnswer = () => ({ reply: '', postOptions: ['Back in the forest with @[Sam Ridge]'] });
  // A post with Sam's chip and an untouched Bluesky card: Sam has a handle only there.
  await fromPostMenu(page, 'Summer recap, part 1, with', 'Send to channels');
  await button(copyCard(sendSheet(page), 'Bluesky'), 'Edit').click();
  const editor = page.getByTestId('channel-copy-editor');
  await button(editor, 'Post ideas').click();

  // The post's chip and the idea's.
  await expect(editor.getByText('@ridgeline.bsky.social', { exact: true })).toHaveCount(2);
});

test("a copy warns about a contact without a handle there until Add handle, and Send now locks it until it's marked as not sent", async ({
  page,
}) => {
  await fromPostMenu(page, CHIP_POST, 'Send to channels');
  const card = copyCard(sendSheet(page), 'Instagram');
  await expect(card.getByText('Sam Ridge has no Instagram handle')).toBeVisible();
  await button(card, 'Edit').click();
  const editor = page.getByTestId('channel-copy-editor');
  await expect(editor.getByText('Sam Ridge has no Instagram handle')).toBeVisible();
  // The note's own Add handle, as on the card.
  await expect(button(editor, 'Add handle')).toBeVisible();
  await button(editor, 'Back').click();

  await withDialog(
    page,
    (dialog) => dialog.accept('samridge.pics'),
    () => button(card, 'Add handle').click(),
  );
  await expect(card.getByText('Sam Ridge has no Instagram handle')).toBeHidden();

  await button(card, 'Send now').click();
  await expect(card.getByText(/^Sent /)).toBeVisible();
  await expect(button(card, 'Edit')).toBeHidden();
  await expect.poll(() => clipboard(page)).toBe('Lost in the forest for a day with @samridge.pics 🌲');

  await button(card, 'Instagram copy options').click();
  await page.getByRole('menuitem', { name: 'Mark as not sent' }).click();
  await expect(button(card, 'Send now')).toBeVisible();
});

test("a repost starts with the post's own copies, unsent, and a card for every other channel", async ({ page }) => {
  const cards = postCards(page.getByTestId('posts-screen')).filter({ hasText: CHIP_POST });
  const post = await fromPostMenu(page, CHIP_POST, 'Repost');
  const shown = await cards.count();
  const editor = page.getByTestId('post-editor');
  await button(editor, 'Add').click();
  await expect(editor).toBeHidden();
  await button(post, 'Back').click();

  // The repost is in the list (the newest) before it is opened.
  await expect(cards).toHaveCount(shown + 1);
  await fromPostMenu(page, CHIP_POST, 'Send to channels');
  const sheet = sendSheet(page);
  for (const channel of CHANNELS) await expect(button(copyCard(sheet, channel), 'Send now')).toBeVisible();
  // The Bluesky copy is his own, so the repost starts with its text; the Instagram one follows the repost.
  await expect(copyCard(sheet, 'Bluesky').getByText('A whole day under the trees', { exact: false })).toBeVisible();
  await expect(button(sheet, 'Send all')).toBeVisible();
});
