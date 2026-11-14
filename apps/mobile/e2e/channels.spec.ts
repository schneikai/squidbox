import type { Locator, Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, openTab, pickFromSquidbox, postCards, withDialog } from './helpers';
import { resetMockDataAsync } from '../../../scripts/localBackend.mjs';

// A post's channels, end to end, through the channel bar: the mock account's channels (Bluesky, X,
// Instagram) in Settings and one added, a post written for Bluesky and X in the editor (one version for
// both with X's limits, X written separately, add, switch, remove), its channels' logos in the posts
// list, its screen switching versions in place, Edit on the version shown, X ticked back onto Bluesky's
// version, and Delete; a mock post's X version; removing a post's own version; the mock post shared by
// Bluesky and X; and no bar without channels. The flows change the mock account, so the mock data is reset after them,
// whatever happened (no cleanup through the UI a failed run would skip).
test.afterAll(async () => {
  await resetMockDataAsync();
});

const TEXT = 'Sunrise on the ridge. Worth every switchback.';
const X_TEXT = 'Sunrise on the ridge.';
const RECAP = 'Summer recap, part 1';
const RECAP_X = 'Summer recap, part 1 🧵';
const RECAP_X_THREAD = 'The coast road, one stop at every pull-out 🌊';
const FOREST = 'Lost in the forest for a day';

// The cards of the channel that shows (hidden channels keep theirs mounted).
function shown(editor: Locator) {
  return editor.getByTestId('post-editor-channel');
}

function caption(editor: Locator) {
  return shown(editor).getByPlaceholder("What's new?").first();
}

function tab(scope: Locator, name: string) {
  return scope.getByRole('tab', { name, exact: true });
}

function menuItem(page: Page, name: string) {
  return page.getByRole('menuitem', { name, exact: true });
}

// A channel's row in a version's menu: ticked when the version goes there.
function channelRow(page: Page, name: string) {
  return page.getByRole('checkbox', { name, exact: true });
}

// Opens Settings → Channels.
async function openChannels(page: Page) {
  await button(page.getByTestId('library-screen'), 'Settings').click();
  await page.getByTestId('settings-screen').getByText('Channels', { exact: true }).click();
  return page.getByTestId('channels-screen');
}

// Removes the version named `name` from the post, through its menu and the confirm.
async function removeShown(page: Page, editor: Locator, name: string) {
  await tab(editor, name).click();
  let message = '';
  await withDialog(
    page,
    async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    },
    () => menuItem(page, 'Remove this version').click(),
  );
  expect(message).toContain('Remove this version?');
}

// No element with `inner` role inside one with `outer`: a channel tab never nests a button.
async function expectNoNested(scope: Locator, outer: string, inner: string) {
  await expect(scope.locator(`[role=${outer}] [role=${inner}]`)).toHaveCount(0);
}

test('a post written for Bluesky and X shares a version, writes X separately, adds and removes versions', async ({
  page,
}) => {
  const channels = await openChannels(page);
  for (const name of ['Bluesky', 'X', 'Instagram'])
    await expect(channels.getByText(name, { exact: true })).toBeVisible();
  await channels.getByText('Add channel').first().click();
  await page.getByTestId('add-channel-sheet').getByText('OnlyFans', { exact: true }).click();
  await expect(channels.getByText('OnlyFans', { exact: true })).toBeVisible();
  await button(channels, 'Back').click();
  const settings = page.getByTestId('settings-screen');
  await expect(settings.getByRole('button', { name: /^Channels/ })).toContainText('4');

  // The editor: one tab, the user's first channel, with its limits.
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'New post').click();
  const editor = page.getByTestId('post-editor');
  await expect(editor.getByRole('tab')).toHaveCount(1);
  await expect(tab(editor, 'Bluesky')).toHaveAttribute('aria-selected', 'true');
  // The counter shows only near the limit.
  await expect(shown(editor).getByText('0 / 300')).toHaveCount(0);
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 2);
  await expect(shown(editor).getByText('2 of 4 Assets', { exact: false })).toBeVisible();

  // Near Bluesky's limit the counter shows; past it, it turns red, and Add stays on.
  await caption(editor).fill('a'.repeat(280));
  const normal = await shown(editor)
    .getByText('280 / 300')
    .evaluate((node) => getComputedStyle(node).color);
  await caption(editor).fill('a'.repeat(301));
  const over = await shown(editor)
    .getByText('301 / 300')
    .evaluate((node) => getComputedStyle(node).color);
  expect(over).not.toBe(normal);
  await expect(button(editor, 'Add')).toBeEnabled();
  await caption(editor).fill(TEXT);
  await expect(shown(editor).getByText(`${TEXT.length} / 300`)).toHaveCount(0);

  // The version's menu: its only channel can't be unticked, and there is no Remove.
  await tab(editor, 'Bluesky').click();
  await expect(page.getByRole('heading', { name: 'This version is for' })).toBeVisible();
  await expect(channelRow(page, 'Bluesky')).toHaveAttribute('aria-checked', 'true');
  await expect(channelRow(page, 'Bluesky')).toHaveAttribute('aria-disabled', 'true');
  await expect(menuItem(page, 'Remove this version')).toHaveCount(0);
  // Ticking X keeps the menu open; a tap outside closes it, and the one tab goes to both.
  await expect(channelRow(page, 'X')).toHaveAttribute('aria-checked', 'false');
  await channelRow(page, 'X').click();
  await expect(channelRow(page, 'X')).toHaveAttribute('aria-checked', 'true');
  await expect(channelRow(page, 'Bluesky')).not.toHaveAttribute('aria-disabled', 'true');
  await page.mouse.click(5, 5);
  await expect(channelRow(page, 'X')).toHaveCount(0);
  await expect(editor.getByRole('tab')).toHaveCount(1);
  await expect(tab(editor, 'Bluesky and X')).toHaveAttribute('aria-selected', 'true');

  // A shared version takes the strictest limits, X's, and the counter names it.
  await caption(editor).fill('a'.repeat(281));
  await expect(shown(editor).getByText('281 / 280 · X')).toBeVisible();
  await caption(editor).fill(TEXT);

  // Write X separately: X gets a version of its own, a copy, and shows.
  await tab(editor, 'Bluesky and X').click();
  await menuItem(page, 'Write X separately').click();
  await expect(editor.getByRole('tab')).toHaveCount(2);
  await expect(tab(editor, 'Bluesky')).toBeVisible();
  await expect(tab(editor, 'X')).toHaveAttribute('aria-selected', 'true');
  await expect(caption(editor)).toHaveValue(TEXT);
  await expect(shown(editor).getByText('2 of 4 Assets', { exact: false })).toBeVisible();

  // Switching keeps each version's text.
  await caption(editor).fill(X_TEXT);
  await tab(editor, 'Bluesky').click();
  await expect(caption(editor)).toHaveValue(TEXT);
  await tab(editor, 'X').click();
  await expect(caption(editor)).toHaveValue(X_TEXT);
  await expect(page.getByText('Other channels')).toHaveCount(0);
  await expect(page.getByTestId('post-channel-editor')).toHaveCount(0);
  await expectNoNested(editor, 'button', 'button');
  await expectNoNested(editor, 'tab', 'button');

  // + adds one of his channels the post isn't on, as a copy of the one that shows, and selects it.
  await button(editor, 'Add channel').click();
  await expect(page.getByRole('heading', { name: 'Add channel' })).toBeVisible();
  for (const name of ['Instagram', 'OnlyFans']) await expect(menuItem(page, name)).toBeVisible();
  for (const name of ['Bluesky', 'X']) await expect(menuItem(page, name)).toHaveCount(0);
  await menuItem(page, 'Instagram').click();
  await expect(tab(editor, 'Instagram')).toHaveAttribute('aria-selected', 'true');
  await expect(caption(editor)).toHaveValue(X_TEXT);

  // Every channel used: no +. Removing a version asks, then selects the first and brings + back.
  await button(editor, 'Add channel').click();
  await menuItem(page, 'OnlyFans').click();
  await expect(button(editor, 'Add channel')).toHaveCount(0);
  await removeShown(page, editor, 'OnlyFans');
  await expect(tab(editor, 'OnlyFans')).toHaveCount(0);
  await expect(tab(editor, 'Bluesky')).toHaveAttribute('aria-selected', 'true');
  await expect(button(editor, 'Add channel')).toBeVisible();
  await tab(editor, 'Instagram').click();
  await removeShown(page, editor, 'Instagram');
  await expect(editor.getByRole('tab')).toHaveCount(2);

  await button(editor, 'Add').click();
  await editor.waitFor({ state: 'detached' });

  // The posts list's card: both channels' logos.
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).first();
  await expect(card.getByText(TEXT)).toBeVisible();
  await expect(card.getByRole('img', { name: 'Bluesky and X', exact: true })).toBeVisible();

  // The post's screen: its bar switches the card in place.
  await card.getByText(TEXT).click();
  const post = page.getByTestId('post-screen');
  await expect(tab(post, 'Bluesky')).toHaveAttribute('aria-selected', 'true');
  await expect(post.getByText(TEXT, { exact: true })).toBeVisible();
  const url = page.url();
  await tab(post, 'X').click();
  await expect(tab(post, 'X')).toHaveAttribute('aria-selected', 'true');
  await expect(post.getByText(X_TEXT, { exact: true })).toBeVisible();
  await expect(post.getByText(TEXT, { exact: true })).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expectNoNested(post, 'button', 'button');
  await expectNoNested(post, 'tab', 'button');

  // Edit opens on the version shown. Remove the X version, tick X back onto Bluesky's, and save: one
  // tab for both.
  await button(post, 'Post options').click();
  await menuItem(page, 'Edit').click();
  await expect(tab(editor, 'X')).toHaveAttribute('aria-selected', 'true');
  await expect(caption(editor)).toHaveValue(X_TEXT);
  await removeShown(page, editor, 'X');
  await tab(editor, 'Bluesky').click();
  await channelRow(page, 'X').click();
  await page.mouse.click(5, 5);
  await expect(channelRow(page, 'X')).toHaveCount(0);
  await button(editor, 'Save').click();
  await editor.waitFor({ state: 'detached' });
  await expect(post.getByRole('tab')).toHaveCount(1);
  await expect(tab(post, 'Bluesky and X')).toHaveAttribute('aria-selected', 'true');
  await expect(post.getByText(TEXT, { exact: true })).toBeVisible();

  // Delete names every channel, and leaves for the list without another dialog.
  await button(post, 'Post options').click();
  let message = '';
  await withDialog(
    page,
    async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    },
    () => menuItem(page, 'Delete').click(),
  );
  expect(message).toContain('It goes on all its channels: Bluesky and X.');
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await expect(posts).toBeVisible();
  await expect(post).toHaveCount(0);
  await expect(posts.getByText(TEXT)).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('a mock post shows its X version and thread in place, and keeps X when its own version is removed', async ({
  page,
}) => {
  await openTab(page, 'Posts');
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).filter({ hasText: RECAP });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('img', { name: 'Bluesky and X', exact: true })).toBeVisible();

  await card.getByText(RECAP, { exact: false }).click();
  const post = page.getByTestId('post-screen');
  await tab(post, 'X').click();
  await expect(post.getByText(RECAP_X, { exact: true })).toBeVisible();
  await expect(post.getByText(RECAP_X_THREAD)).toBeVisible();

  // Edit it, remove Bluesky (its own channel), save: X is the post now, with its thread.
  await button(post, 'Post options').click();
  await menuItem(page, 'Edit').click();
  const editor = page.getByTestId('post-editor');
  await expect(tab(editor, 'X')).toHaveAttribute('aria-selected', 'true');
  await tab(editor, 'Bluesky').click();
  await removeShown(page, editor, 'Bluesky');
  await expect(tab(editor, 'X')).toHaveAttribute('aria-selected', 'true');
  await button(editor, 'Save').click();
  await editor.waitFor({ state: 'detached' });

  await expect(post.getByRole('tab')).toHaveCount(1);
  await expect(tab(post, 'X')).toHaveAttribute('aria-selected', 'true');
  await expect(post.getByText(RECAP_X, { exact: true })).toBeVisible();
  await expect(post.getByText(RECAP_X_THREAD)).toBeVisible();
  await button(post, 'Back').click();
  const saved = postCards(posts).filter({ hasText: RECAP_X });
  await expect(saved.getByRole('img', { name: 'X', exact: true })).toBeVisible();
});

test('the mock post shared by Bluesky and X shows one tab for both, and Delete names both', async ({ page }) => {
  await openTab(page, 'Posts');
  const posts = page.getByTestId('posts-screen');
  const card = postCards(posts).filter({ hasText: FOREST });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('img', { name: 'Bluesky and X', exact: true })).toBeVisible();

  await card.getByText(FOREST, { exact: false }).click();
  const post = page.getByTestId('post-screen');
  await expect(post.getByRole('tab')).toHaveCount(1);
  await expect(tab(post, 'Bluesky and X')).toHaveAttribute('aria-selected', 'true');
  await button(post, 'Post options').click();
  let message = '';
  await withDialog(
    page,
    async (dialog) => {
      message = dialog.message();
      await dialog.dismiss();
    },
    () => menuItem(page, 'Delete').click(),
  );
  expect(message).toContain('It goes on all its channels: Bluesky and X.');
  await expect(post).toBeVisible();
});

test('without channels a new post has no bar, and a post on channels still shows its own', async ({ page }) => {
  // Every channel he has, OnlyFans too when the first flow added it (the data is reset after the file).
  const channels = await openChannels(page);
  await expect(channels.getByText('Bluesky', { exact: true })).toBeVisible();
  for (const name of ['Bluesky', 'X', 'Instagram', 'OnlyFans']) {
    const row = channels.getByText(name, { exact: true });
    if ((await row.count()) === 0) continue;
    await row.hover();
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await menuItem(page, 'Delete').click();
    await expect(row).toHaveCount(0);
  }
  await expect(channels.getByText('No channels yet')).toBeVisible();
  await button(channels, 'Back').click();

  await openTab(page, 'Posts');
  const posts = page.getByTestId('posts-screen');
  await button(posts, 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'New post').click();
  const editor = page.getByTestId('post-editor');
  await expect(caption(editor)).toBeVisible();
  await expect(editor.getByRole('tablist')).toHaveCount(0);
  await button(editor, 'Close').click();
  await editor.waitFor({ state: 'detached' });
  await button(page.getByTestId('new-post-sheet'), 'Close').click();

  const card = postCards(posts).filter({ hasText: 'Quiet roads' }).first();
  await card.scrollIntoViewIfNeeded();
  await card.getByText('Quiet roads', { exact: false }).first().click();
  const post = page.getByTestId('post-screen');
  await expect(tab(post, 'Bluesky')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(post, 'X')).toBeVisible();
});
