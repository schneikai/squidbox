import type { Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, openTab, pickFromSquidbox, postCards, withDialog } from './helpers';
import { resetMockDataAsync } from '../../../scripts/localBackend.mjs';

// A post's channels, end to end: the mock account's channels (Bluesky, X, Instagram) in Settings and
// one added, a post written for Bluesky with an X channel in the editor, its labels in the posts list,
// its screen and the channel's screen, and Delete from there. The flow adds a channel to the mock
// account, so the mock data is reset after it, whatever happened (no cleanup through the UI a failed
// run would skip).
test.afterAll(async () => {
  await resetMockDataAsync();
});

const TEXT = 'Sunrise on the ridge. Worth every switchback.';
const X_TEXT = 'Sunrise on the ridge.';

function caption(scope: Locator) {
  return scope.getByPlaceholder("What's new?").first();
}

// Opens Settings → Channels.
async function openChannels(page: Page) {
  await button(page.getByTestId('library-screen'), 'Settings').click();
  await page.getByTestId('settings-screen').getByText('Channels', { exact: true }).click();
  return page.getByTestId('channels-screen');
}

test('a post written for Bluesky and X shows both, and Delete removes it on both', async ({ page }) => {
  const channels = await openChannels(page);
  for (const name of ['Bluesky', 'X', 'Instagram'])
    await expect(channels.getByText(name, { exact: true })).toBeVisible();
  await channels.getByText('Add channel').first().click();
  await page.getByTestId('add-channel-sheet').getByText('OnlyFans', { exact: true }).click();
  await expect(channels.getByText('OnlyFans', { exact: true })).toBeVisible();
  await button(channels, 'Back').click();
  const settings = page.getByTestId('settings-screen');
  await expect(settings.getByRole('button', { name: /^Channels/ })).toContainText('4');

  // The editor: the user's first channel, its limits, and the selector's Add channel.
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'New post').click();
  const editor = page.getByTestId('post-editor');
  await expect(button(editor, 'Channel: Bluesky')).toBeVisible();
  await expect(editor.getByText('0 / 300')).toBeVisible();
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 2);
  await expect(editor.getByText('2 of 4 Assets', { exact: false })).toBeVisible();

  // Past Bluesky's limit: the counter turns red, and Add stays on.
  await caption(editor).fill(TEXT);
  const normal = await editor.getByText(`${TEXT.length} / 300`).evaluate((node) => getComputedStyle(node).color);
  await caption(editor).fill('a'.repeat(301));
  const over = await editor.getByText('301 / 300').evaluate((node) => getComputedStyle(node).color);
  expect(over).not.toBe(normal);
  await expect(button(editor, 'Add')).toBeEnabled();
  await caption(editor).fill(TEXT);

  // Add channel takes the next of his channels the post isn't on: X, holding the same text and photos.
  await button(editor, 'Channel: Bluesky').click();
  await page.getByRole('menuitem', { name: 'Add channel' }).click();
  const step = page.getByTestId('post-channel-editor');
  await expect(step.getByText('X', { exact: true }).first()).toBeVisible();
  await expect(caption(step)).toHaveValue(TEXT);
  await expect(step.getByText(`${TEXT.length} / 280`)).toBeVisible();
  await expect(step.getByText('2 of 4 Assets', { exact: false })).toBeVisible();
  await caption(step).fill(X_TEXT);
  await button(step, 'Done').click();

  await expect(editor.getByText('Other channels')).toBeVisible();
  await expect(button(editor, 'X')).toBeVisible();
  await button(editor, 'Add').click();
  await editor.waitFor({ state: 'detached' });

  // The posts list's card: both labels.
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).first();
  await expect(card.getByText(TEXT)).toBeVisible();
  await expect(card.getByText('Bluesky', { exact: true })).toBeVisible();
  await expect(card.getByText('X', { exact: true })).toBeVisible();

  // The post's screen: its own label, and Other channels with X's row.
  await card.getByText(TEXT).click();
  const post = page.getByTestId('post-screen');
  await expect(postCards(post).first().getByText('Bluesky', { exact: true })).toBeVisible();
  await expect(post.getByText('Other channels')).toBeVisible();
  await button(post, 'X').click();

  // The channel's screen, and Delete from it: both screens leave, without "This post was deleted".
  const channel = page.getByTestId('post-channel-screen');
  await expect(channel.getByText(X_TEXT, { exact: true })).toBeVisible();
  await button(channel, 'Post options').click();
  let message = '';
  await withDialog(
    page,
    async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    },
    () => page.getByRole('menuitem', { name: 'Delete' }).click(),
  );
  expect(message).toContain('It goes on all its channels: Bluesky and X.');
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await expect(posts).toBeVisible();
  await expect(channel).toHaveCount(0);
  await expect(post).toHaveCount(0);
  await expect(posts.getByText(TEXT)).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('a mock post on X shows its label in the list, and its X screen its own text and thread', async ({ page }) => {
  await openTab(page, 'Posts');
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).filter({ hasText: 'Summer recap, part 1' });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText('Bluesky', { exact: true })).toBeVisible();
  await expect(card.getByText('X', { exact: true })).toBeVisible();

  await card.getByText('Summer recap, part 1', { exact: false }).click();
  const post = page.getByTestId('post-screen');
  await post.getByText('Other channels').scrollIntoViewIfNeeded();
  await button(post, 'X').click();
  const channel = page.getByTestId('post-channel-screen');
  await expect(channel.getByText('Summer recap, part 1 🧵', { exact: true })).toBeVisible();
  await expect(channel.getByText('The coast road, one stop at every pull-out 🌊')).toBeVisible();
});
