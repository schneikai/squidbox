import type { BrowserContext, Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, expectPostText, openTab, postCards, postText, withDialog } from './helpers';

// The mock post that mentions Sam Ridge by chip, with a sent Bluesky copy and an unsent Instagram one
// (Sam has no Instagram handle).
const CHIP_POST = 'Lost in the forest for a day with';

test.beforeEach(async ({ context }: { context: BrowserContext }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

// Opens the post with `text` from the posts list (the newest of them), then its ⋯ menu's `item`.
async function fromPostMenu(page: Page, text: string, item: string) {
  await openTab(page, 'Posts');
  await postCards(page.getByTestId('posts-screen')).filter({ hasText: text }).first().click();
  const post = page.getByTestId('post-screen');
  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  return post;
}

const sendSheet = (page: Page) => page.getByTestId('send-to-channels-sheet');
const copyCard = (sheet: Locator, channel: string) => sheet.getByLabel(`${channel} copy`, { exact: true });
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test("Copy text asks for which channel, and copies the chip as the contact's handle there", async ({ page }) => {
  await fromPostMenu(page, CHIP_POST, 'Copy text');
  await page.getByRole('button', { name: 'Bluesky', exact: false }).first().click();

  await expect.poll(() => clipboard(page)).toBe('Lost in the forest for a day with @ridgeline.bsky.social 🌲');
});

test("a post card's copy icon asks like Copy text, and names a contact without a handle there", async ({ page }) => {
  await openTab(page, 'Posts');
  await postCards(page.getByTestId('posts-screen')).filter({ hasText: CHIP_POST }).first().click();
  await button(page.getByTestId('post-screen'), 'Copy text').click();
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
  await button(copy, 'Copy text').click();

  await expect.poll(() => clipboard(page)).toBe('Lost in the forest for a day with @ridgeline.bsky.social 🌲');
});

test('a channel added with + gets a copy filled from the post, and Send all marks every unsent copy sent', async ({
  page,
}) => {
  await fromPostMenu(page, 'Coffee and a view', 'Send to channels');
  const sheet = sendSheet(page);
  await expect(sheet.getByText('Send this post to your channels')).toBeVisible();

  for (const channel of ['Bluesky', 'X']) {
    await button(sheet, 'Add channel').click();
    await page.getByRole('menuitem', { name: channel, exact: true }).click();
    const editor = page.getByTestId('channel-copy-editor');
    await expectPostText(postText(editor), 'Coffee and a view. That is all.');
    await button(editor, 'Add').click();
    await expect(copyCard(sheet, channel)).toBeVisible();
  }

  await button(sheet, 'Send all').click();
  for (const channel of ['Bluesky', 'X']) await expect(copyCard(sheet, channel).getByText(/^Sent /)).toBeVisible();
  await expect(button(sheet, 'Send all')).toBeHidden();
});

test("Use on an idea in a copy's composer puts in the chip of a name the idea writes", async ({ page, assistant }) => {
  assistant.chatAnswer = () => ({ reply: '', postOptions: ['Back in the forest with Sam Ridge'] });
  await fromPostMenu(page, CHIP_POST, 'Send to channels');
  await button(sendSheet(page), 'Add channel').click();
  await page.getByRole('menuitem', { name: 'X', exact: true }).click();
  const editor = page.getByTestId('channel-copy-editor');
  await button(editor, 'Post ideas').click();
  await button(editor, 'Use').click();

  await expect(button(postText(editor), 'Sam Ridge')).toBeVisible();
  // A chip, so the copy says Sam has no X handle.
  await expect(editor.getByText('Sam Ridge has no X handle')).toBeVisible();
  await withDialog(
    page,
    (dialog) => dialog.accept(),
    () => button(editor, 'Close').click(),
  );
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
  await button(editor, 'Close').click();

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

test("a repost starts with the post's copies, unsent", async ({ page }) => {
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
  for (const channel of ['Bluesky', 'Instagram']) {
    await expect(button(copyCard(sheet, channel), 'Send now')).toBeVisible();
  }
  await expect(button(sheet, 'Send all')).toBeVisible();
});
