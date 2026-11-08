import type { Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, openTab, pickFromSquidbox, postCards, uniqueName } from './helpers';

// Writes a new post with two photos from the library and adds it. The editor opens from the New
// post sheet (the mock data has posts to repost, so the sheet shows), and Add closes both sheets.
async function addPost(page: Page, text: string) {
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  const newPost = page.getByTestId('new-post-sheet');
  await button(newPost, 'New post').click();
  const editor = page.getByTestId('post-editor');
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 2);
  await editor.getByPlaceholder("What's new?").fill(text);
  await button(editor, 'Add').click();
  await expect(editor).toBeHidden();
  await expect(newPost).toBeHidden();
}

test('Add saves a new post with its photos and lands on the posts list', async ({ page }) => {
  const text = uniqueName('Ridge trail at dawn');

  await addPost(page, text);

  const card = postCards(page.getByTestId('posts-screen')).filter({ hasText: text });
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveCount(2);
});

test('a saved post is still in the list after a reload', async ({ page }) => {
  const text = uniqueName('Creek crossing');
  await addPost(page, text);

  await page.reload();

  await openTab(page, 'Posts');
  await expect(postCards(page.getByTestId('posts-screen')).filter({ hasText: text })).toBeVisible();
});

test('typing @ and part of a name suggests the contact, and a tap writes its handle', async ({ page }) => {
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'New post').click();
  const editor = page.getByTestId('post-editor');
  const text = editor.getByPlaceholder("What's new?");

  await text.pressSequentially('Out with @lind');
  await button(editor.getByTestId('mention-suggestions'), 'Maya Lindqvist, @mayalindqvist on X').click();

  await expect(text).toHaveValue('Out with @mayalindqvist ');
  await expect(editor.getByTestId('mention-suggestions')).toBeHidden();
});
