/* eslint-env node, browser */
import { expect, test } from './fixtures.mjs';
import { button, openTab, pickFromSquidbox, postCards, uniqueName } from './helpers.mjs';

// Writes a new post with two photos from the library and adds it. The editor opens from the New
// post sheet (the mock data has posts to repost, so the sheet shows) and goes back to it.
async function addPost(page, text) {
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
  await button(newPost, 'Close').click();
  await expect(newPost).toBeHidden();
}

test('Add saves a new post with its photos to the posts list', async ({ page }) => {
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
