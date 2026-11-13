import type { Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, openTab, pickFromSquidbox, postCards, withDialog } from './helpers';
import { resetMockDataAsync } from '../../../scripts/localBackend.mjs';

// A post's channels, end to end: the user's channels in Settings, a post written for X with an
// OnlyFans channel in the editor, its labels in the posts list, its screen and the channel's screen,
// and Delete from there. The flow adds channels to the mock account, so the mock data is reset after
// it, whatever happened (no cleanup through the UI a failed run would skip).
test.afterAll(async () => {
  await resetMockDataAsync();
});

const TEXT = 'Sunrise on the ridge. Worth every switchback.';
const ONLYFANS_TEXT = 'The whole sunrise run, start to summit.';

function caption(scope: Locator) {
  return scope.getByPlaceholder("What's new?").first();
}

// Opens Settings → Channels.
async function openChannels(page: Page) {
  await button(page.getByTestId('library-screen'), 'Settings').click();
  await page.getByTestId('settings-screen').getByText('Channels', { exact: true }).click();
  return page.getByTestId('channels-screen');
}

async function addChannel(page: Page, channels: Locator, name: string) {
  await channels.getByText('Add channel').first().click();
  await page.getByTestId('add-channel-sheet').getByText(name, { exact: true }).click();
  await expect(channels.getByText(name, { exact: true })).toBeVisible();
}

test('a post written for X and OnlyFans shows both, and Delete removes it on both', async ({ page }) => {
  const channels = await openChannels(page);
  await expect(channels.getByText('No channels yet')).toBeVisible();
  await addChannel(page, channels, 'X');
  await addChannel(page, channels, 'OnlyFans');
  await button(channels, 'Back').click();
  const settings = page.getByTestId('settings-screen');
  await expect(settings.getByRole('button', { name: /^Channels/ })).toContainText('2');

  // The editor: the user's first channel, its limits, and the selector's Add channel.
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'New post').click();
  const editor = page.getByTestId('post-editor');
  await expect(button(editor, 'Channel: X')).toBeVisible();
  await expect(editor.getByText('0 / 280')).toBeVisible();
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 2);
  await expect(editor.getByText('2 of 4 Assets', { exact: false })).toBeVisible();

  // Past X's limit: the counter turns red, and Add stays on.
  await caption(editor).fill(TEXT);
  const normal = await editor.getByText(`${TEXT.length} / 280`).evaluate((node) => getComputedStyle(node).color);
  await caption(editor).fill('a'.repeat(281));
  const over = await editor.getByText('281 / 280').evaluate((node) => getComputedStyle(node).color);
  expect(over).not.toBe(normal);
  await expect(button(editor, 'Add')).toBeEnabled();
  await caption(editor).fill(TEXT);

  await button(editor, 'Channel: X').click();
  await page.getByRole('menuitem', { name: 'Add channel' }).click();
  const step = page.getByTestId('post-channel-editor');
  await expect(step.getByText('OnlyFans', { exact: true }).first()).toBeVisible();
  await expect(caption(step)).toHaveValue(TEXT);
  await expect(step.getByText('2 of 20 Assets', { exact: false })).toBeVisible();
  await caption(step).fill(ONLYFANS_TEXT);
  await button(step, 'Done').click();

  await expect(editor.getByText('Other channels')).toBeVisible();
  await expect(button(editor, 'OnlyFans')).toBeVisible();
  await button(editor, 'Add').click();
  await editor.waitFor({ state: 'detached' });

  // The posts list's card: both labels.
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).first();
  await expect(card.getByText(TEXT)).toBeVisible();
  await expect(card.getByText('X', { exact: true })).toBeVisible();
  await expect(card.getByText('OnlyFans', { exact: true })).toBeVisible();

  // The post's screen: its own label, and Other channels with OnlyFans's row.
  await card.getByText(TEXT).click();
  const post = page.getByTestId('post-screen');
  await expect(postCards(post).first().getByText('X', { exact: true })).toBeVisible();
  await expect(post.getByText('Other channels')).toBeVisible();
  await button(post, 'OnlyFans').click();

  // The channel's screen, and Delete from it: both screens leave, without "This post was deleted".
  const channel = page.getByTestId('post-channel-screen');
  await expect(channel.getByText(ONLYFANS_TEXT)).toBeVisible();
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
  expect(message).toContain('It goes on all its channels: X and OnlyFans.');
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
