/* eslint-env node, browser */
import { expect, test } from './fixtures.mjs';
import { openTab, uniqueName, withDialog } from './helpers.mjs';

// Opens the first post's editor and changes its text; returns the editor and the original text.
async function editFirstPost(page) {
  await openTab(page, 'Posts');
  await page.getByTestId('posts-screen').getByTestId('post-card').first().click();
  const post = page.getByTestId('post-screen');
  await post.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editor = page.getByTestId('post-editor');
  const field = editor.getByPlaceholder("What's new?").first();
  const original = await field.inputValue();
  const changed = uniqueName('Changed my mind about the ridge');
  await field.fill(changed);
  return { editor, field, original, changed };
}

test('closing the editor with unsaved changes asks first, and Keep editing keeps the draft', async ({
  app: { page },
}) => {
  const { editor, field, changed } = await editFirstPost(page);

  await withDialog(
    page,
    (dialog) => dialog.dismiss(),
    () => editor.getByRole('button', { name: 'Close', exact: true }).click(),
  );

  await expect(editor).toBeVisible();
  await expect(field).toHaveValue(changed);
});

test('Discard closes the editor without saving', async ({ app: { page } }) => {
  const { editor, original } = await editFirstPost(page);

  await withDialog(
    page,
    (dialog) => dialog.accept(),
    () => editor.getByRole('button', { name: 'Close', exact: true }).click(),
  );

  await expect(editor).toBeHidden();
  await expect(page.getByTestId('post-screen').getByText(original, { exact: true })).toBeVisible();
});
