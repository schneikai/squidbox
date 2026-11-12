import { type ChatRequest, type ChatResponse, loginResponseSchema } from '@squidbox/shared';
import { expect, type Page, type Route, test as base } from 'playwright/test';

import { collectErrors, loadAppAsync, loginAsync, signInAsync } from '../scripts/webPreview.mjs';

// The tags every photo gets from the stubbed assistant.
export const STUB_TAGS = ['pebble beach', 'driftwood'];

/**
 * The assistant as the flows see it: `/ai/chat` and `/ai/tags` answered in the page, never by the
 * server (which would ask Venice), and recorded. `chats` are the chat requests' bodies in order, and
 * `events` the order of the calls ('tags' or 'chat'). Each chat answers `chatAnswer(n)` (n from 1: by
 * default three options of its own, `Idea n.1` …); `holdChats()` keeps the answers back until the
 * function it returns is called, so a test can see what shows while ideas are written.
 */
export type StubAssistant = {
  chats: ChatRequest[];
  events: ('tags' | 'chat')[];
  chatAnswer: (n: number) => ChatResponse;
  holdChats: () => () => void;
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Answers `route` with `body` as JSON, and a preflight with its CORS headers alone.
async function fulfill(route: Route, body: () => Promise<unknown>) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  return route.fulfill({
    status: 200,
    headers: CORS,
    contentType: 'application/json',
    body: JSON.stringify(await body()),
  });
}

// Each test's page's stub, for its `assistant`.
const stubs = new WeakMap<Page, StubAssistant>();

async function stubAssistantAsync(page: Page): Promise<StubAssistant> {
  let hold: Promise<void> | null = null;
  const assistant: StubAssistant = {
    chats: [],
    events: [],
    chatAnswer: (n) => ({ reply: '', postOptions: [1, 2, 3].map((index) => `Idea ${n}.${index} on the coast road`) }),
    holdChats: () => {
      let release = () => {};
      hold = new Promise((resolve) => (release = resolve));
      return () => {
        hold = null;
        release();
      };
    },
  };
  await page.route('**/ai/tags', (route) =>
    fulfill(route, async () => {
      assistant.events.push('tags');
      return { tags: STUB_TAGS };
    }),
  );
  await page.route('**/ai/chat', (route) =>
    fulfill(route, async () => {
      assistant.chats.push(route.request().postDataJSON() as ChatRequest);
      assistant.events.push('chat');
      const n = assistant.chats.length;
      await hold;
      return assistant.chatAnswer(n);
    }),
  );
  return assistant;
}

/**
 * `page`: Playwright's own (a fresh context per test, with the device and trace from the config)
 * with the app loaded, signed in to the mock account unless a test sets
 * `test.use({ signedIn: false })`, as scripts/webPreview.mjs opens it. A test fails on any uncaught
 * error in the page; console errors (failed image loads, dev warnings) are attached to its report.
 * The assistant is stubbed (`assistant`, StubAssistant): no flow reaches Venice.
 * The tests share one sign-in per worker (`session`): the server allows 10 sign-ins a minute, and
 * the app refreshes its tokens only on a 401, so a test signing out doesn't end the others'.
 */
export const test = base.extend<
  { signedIn: boolean; assistant: StubAssistant },
  { session: ReturnType<typeof loginResponseSchema.parse> }
>({
  signedIn: [true, { option: true }],
  assistant: async ({ page }, use) => use(stubs.get(page)!),
  // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixtures a fixture uses from it
  session: [async ({}, use) => use(loginResponseSchema.parse(await loginAsync())), { scope: 'worker' }],
  page: async ({ page, signedIn, session }, use, testInfo) => {
    stubs.set(page, await stubAssistantAsync(page));
    if (signedIn) await signInAsync(page.context(), session);
    const { pageErrors, consoleErrors } = collectErrors(page);
    await loadAppAsync(page);

    await use(page);

    if (consoleErrors.length > 0) {
      await testInfo.attach('console errors', { body: consoleErrors.join('\n\n'), contentType: 'text/plain' });
    }
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  },
});

export { expect };
