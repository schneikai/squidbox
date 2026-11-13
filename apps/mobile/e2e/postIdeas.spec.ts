import { DEFAULT_IDEA_PROMPTS } from '@squidbox/shared';
import type { Locator, Page } from 'playwright/test';

import { expect, STUB_TAGS, test } from './fixtures';
import { button, openTab, pickFromSquidbox, withDialog } from './helpers';
import { loadAppAsync } from '../scripts/webPreview.mjs';

// The assistant's ideas in the post editor, on the stubbed assistant (fixtures): a new post's start
// once it has photos, a repost's at once, a thread post's on a prompt button, and the chat holds them
// all. The mock account's Post ideas and Repost ideas are on.

// Where the picker's photos no flow tags start: the flows that tag photos take the first ones.
const UNTAGGED = 12;

const firstIdea = (n: number) => `Idea ${n}.1 on the coast road`;

// Opens the New post editor from the Posts tab; returns the sheet and the editor.
async function openNewPost(page: Page) {
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  const newPost = page.getByTestId('new-post-sheet');
  await button(newPost, 'New post').click();
  return { newPost, editor: page.getByTestId('post-editor') };
}

// The caption of the editor's `index`th post.
function caption(editor: Locator, index = 0) {
  return editor.getByPlaceholder("What's new?").nth(index);
}

test('a new post gets ideas once it has photos, written after the photos are tagged', async ({ page, assistant }) => {
  const { editor } = await openNewPost(page);
  await expect(editor.getByText('Write with AI')).toBeVisible();
  expect(assistant.events).toEqual([]);

  const release = assistant.holdChats();
  await button(editor, 'Add photos').click();
  // Photos past the ones other flows tag, so these have no tags yet.
  await pickFromSquidbox(page, 2, UNTAGGED);
  // The title's first copy: the other is its shine, hidden from assistive tech.
  await expect(editor.getByText('Writing ideas…').first()).toBeVisible();
  release();

  await expect(editor.getByText(firstIdea(1))).toBeVisible();
  await expect(button(editor, 'Use')).toHaveCount(3);
  expect(assistant.events).toEqual(['tags', 'tags', 'chat']);
  expect(assistant.chats[0]!.context.tags).toEqual(STUB_TAGS);

  await button(editor, 'Use').first().click();
  await expect(caption(editor)).toHaveValue(firstIdea(1));
  // Use folds the tray into its title's row; a tap unfolds it, the used idea marked.
  await expect(button(editor, 'More')).toHaveCount(0);
  await button(editor, 'Ideas').click();
  await expect(editor.getByText('Used', { exact: true })).toBeVisible();

  await button(editor, 'More').click();
  await expect(editor.getByText(firstIdea(2))).toBeVisible();
  await expect(button(editor, 'Use')).toHaveCount(5);
  expect(assistant.chats[1]!.messages.at(-1)).toMatchObject({ role: 'user', moreIdeas: true });
});

test('the chat holds the ideas, and what is written there comes back to the tray', async ({ page, assistant }) => {
  const { editor } = await openNewPost(page);
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 1);
  await button(editor, 'Use').first().click();
  await button(editor, 'Ideas').click();
  await button(editor, 'More').click();
  await expect(editor.getByText(firstIdea(2))).toBeVisible();

  await button(editor, 'Chat').click();
  const chat = page.getByTestId('post-chat');
  await expect(chat.getByText('Post ideas', { exact: true })).toBeVisible();
  await expect(chat.getByText('You used the first one')).toBeVisible();
  await expect(chat.getByText('More', { exact: true })).toBeVisible();
  await expect(chat.getByText(firstIdea(2))).toBeVisible();

  await button(chat, 'Message').click();
  await chat.getByRole('textbox', { name: 'Message' }).fill('Shorter, and mention the fog');
  await button(chat, 'Send').click();
  await expect(chat.getByText(firstIdea(3))).toBeVisible();
  expect(assistant.chats[2]!.messages.map((turn) => turn.role)).toEqual([
    'user',
    'assistant',
    'user',
    'assistant',
    'user',
  ]);

  await button(chat, 'Close').click();
  await expect(editor.getByText(firstIdea(3))).toBeVisible();
});

test("a thread post offers the prompt buttons, and one loads that post's ideas under its name", async ({
  page,
  assistant,
}) => {
  const { editor } = await openNewPost(page);
  await caption(editor).fill('Fog on the ridge this morning');
  await button(editor, 'Add to thread').click();

  await expect(editor.getByText('Write with AI')).toBeVisible();
  await expect(button(editor, 'Post ideas')).toHaveCount(0);
  expect(assistant.chats).toEqual([]);

  await button(editor, 'Follow-up with link').click();
  await expect(editor.getByText(firstIdea(1))).toBeVisible();
  await expect(button(editor, 'Back to Write with AI')).toBeVisible();
  expect(assistant.chats[0]!.context.thread).toEqual({ index: 1, posts: ['Fog on the ridge this morning', ''] });

  await button(editor, 'Use').first().click();
  await expect(caption(editor, 1)).toHaveValue(firstIdea(1));
  await button(editor, 'Follow-up with link').click();
  await button(editor, 'Back to Write with AI').click();
  await expect(button(editor, 'Follow-up with link')).toBeVisible();
});

test("the first post's tray keeps its ideas while a thread post is written", async ({ page }) => {
  const { editor } = await openNewPost(page);
  await button(editor, 'Add photos').click();
  await pickFromSquidbox(page, 1);
  await button(editor, 'Use').first().click();
  await button(editor, 'Add to thread').click();
  await button(editor, 'Follow-up with link').click();
  await button(editor, 'Use').first().click();

  await caption(editor).click();
  await button(editor, 'Ideas').click();
  await expect(editor.getByText('Used', { exact: true })).toBeVisible();
});

test('a repost opens with its text and its ideas', async ({ page, assistant }) => {
  await openTab(page, 'Posts');
  await button(page.getByTestId('posts-screen'), 'Add').click();
  await button(page.getByTestId('new-post-sheet'), 'Repost').first().click();
  const editor = page.getByTestId('post-editor');

  await expect(editor.getByText(firstIdea(1))).toBeVisible();
  await expect(caption(editor)).not.toHaveValue('');
  // His Repost ideas prompt (seed-mock).
  expect(assistant.chats[0]!.messages[0]).toMatchObject({
    role: 'user',
    content: expect.stringContaining('missed it'),
  });
});

test('a posted post and its editor start no ideas', async ({ page, assistant }) => {
  await openTab(page, 'Posts');
  await page.getByTestId('posts-screen').getByTestId('post-card').first().click();
  const post = page.getByTestId('post-screen');
  await expect(post.getByText('Write with AI')).toBeVisible();
  await button(post, 'Post options').click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page.getByTestId('post-editor').getByText('Write with AI')).toBeVisible();

  expect(assistant.events).toEqual([]);
});

test.describe('Post ideas settings', () => {
  // Opens Settings → Assistant → Post ideas.
  // The prompt on the Post ideas screen; the screens under it keep their text fields in the page.
  const ideasPrompt = (page: Page) => page.getByTestId('ideas-settings-screen').getByRole('textbox');

  async function openPostIdeas(page: Page) {
    await button(page.getByTestId('library-screen'), 'Settings').click();
    await button(page.getByTestId('settings-screen'), 'Assistant').click();
    await button(page, 'Post ideas').click();
  }

  // Runs `action`, a change to the idea settings, and waits for the server to have it: each test
  // starts on a fresh browser that pulls the account, so a change still on this one would be lost.
  async function savedAsync(page: Page, action: () => Promise<void>) {
    const pushed = page.waitForResponse(
      (response) =>
        response.url().endsWith('/sync/push') &&
        response.ok() &&
        (response.request().postData() ?? '').includes('idea_settings'),
    );
    await action();
    await pushed;
  }

  // Puts the switch back on, whatever the test left: the flows share the mock account.
  test.afterEach(async ({ page }) => {
    await loadAppAsync(page);
    await openPostIdeas(page);
    const toggle = page.getByRole('switch', { name: 'Show ideas when I add photos' });
    if (!(await toggle.isChecked())) await savedAsync(page, () => toggle.click());
    await expect(toggle).toBeChecked();
  });

  test('with Post ideas off, a new post waits for its Post ideas chip', async ({ page, assistant }) => {
    await openPostIdeas(page);
    await savedAsync(page, () => page.getByRole('switch', { name: 'Show ideas when I add photos' }).click());
    await expect(page.getByRole('switch', { name: 'Show ideas when I add photos' })).not.toBeChecked();
    await loadAppAsync(page);

    const { editor } = await openNewPost(page);
    await button(editor, 'Add photos').click();
    await pickFromSquidbox(page, 2);
    await expect(button(editor, 'Post ideas')).toBeVisible();
    expect(assistant.events).toEqual([]);

    await button(editor, 'Post ideas').click();
    await expect(editor.getByText(firstIdea(1))).toBeVisible();
  });

  test('an edited prompt is what the next ideas ask, and Reset changes puts the built-in text back', async ({
    page,
    assistant,
  }) => {
    const mine = 'Three short lines about the coast road, one of them a question.';
    await openPostIdeas(page);
    const prompt = ideasPrompt(page);
    const original = await prompt.inputValue();
    await savedAsync(page, async () => {
      await prompt.fill(mine);
      await prompt.blur();
    });
    await loadAppAsync(page);

    const { editor } = await openNewPost(page);
    await button(editor, 'Add photos').click();
    await pickFromSquidbox(page, 1);
    await expect(editor.getByText(firstIdea(1))).toBeVisible();
    expect(assistant.chats[0]!.messages[0]).toMatchObject({ role: 'user', content: mine });

    await loadAppAsync(page);
    await openPostIdeas(page);
    // Reset changes asks first: Cancel keeps the prompt, Reset puts the built-in text back.
    await withDialog(
      page,
      (dialog) => dialog.dismiss(),
      () => button(page, 'Reset changes').click(),
    );
    await expect(ideasPrompt(page)).toHaveValue(mine);
    await savedAsync(page, () =>
      withDialog(
        page,
        (dialog) => dialog.accept(),
        () => button(page, 'Reset changes').click(),
      ),
    );
    await expect(ideasPrompt(page)).toHaveValue(DEFAULT_IDEA_PROMPTS.post);

    // The mock account's own prompt back, for the flows after this one.
    await savedAsync(page, async () => {
      await ideasPrompt(page).fill(original);
      await ideasPrompt(page).blur();
    });
  });
});
