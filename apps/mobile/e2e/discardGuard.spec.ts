import type { Page } from 'playwright/test';

import { expect, test } from './fixtures';
import { button, openTab, postCards, uniqueName, withDialog } from './helpers';

// Opens the first post's editor and changes its text; returns the editor and the original text.
async function editFirstPost(page: Page) {
  await openTab(page, 'Posts');
  await postCards(page.getByTestId('posts-screen')).first().click();
  const post = page.getByTestId('post-screen');
  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editor = page.getByTestId('post-editor');
  const field = editor.getByPlaceholder("What's new?").first();
  const original = await field.inputValue();
  const changed = uniqueName('Changed my mind about the ridge');
  await field.fill(changed);
  return { editor, field, original, changed };
}

test('closing the editor with unsaved changes asks first, and Keep editing keeps the draft', async ({ page }) => {
  const { editor, field, changed } = await editFirstPost(page);

  await withDialog(
    page,
    (dialog) => dialog.dismiss(),
    () => button(editor, 'Close').click(),
  );

  await expect(editor).toBeVisible();
  await expect(field).toHaveValue(changed);
});

test('Discard closes the editor without saving', async ({ page }) => {
  const { editor, original } = await editFirstPost(page);

  await withDialog(
    page,
    (dialog) => dialog.accept(),
    () => button(editor, 'Close').click(),
  );

  await expect(editor).toBeHidden();
  await expect(page.getByTestId('post-screen').getByText(original, { exact: true })).toBeVisible();
});
