import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  toApiUser: (u: { id: string; email: string; features: string[] }) => ({
    id: u.id,
    email: u.email,
    features: u.features,
  }),
}));
// The built-in instructions, nothing published.
vi.mock('../src/ai/instructions.js', async () => {
  const { DEFAULT_INSTRUCTIONS } = await import('@squidbox/shared');
  return {
    readInstructions: vi.fn().mockResolvedValue(DEFAULT_INSTRUCTIONS),
    readAppInstructions: vi.fn().mockResolvedValue(DEFAULT_INSTRUCTIONS),
    publishInstruction: vi.fn(async () => {}),
  };
});
// The assistant's pass: what the writing model answers, set per test; the real contactReadTask.
vi.mock('../src/ai/tasks.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ai/tasks.js')>()),
  runChosenModelTask: vi.fn(),
}));
const venice = vi.hoisted(() => ({ apiKey: undefined as string | undefined }));
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return { ...original, loadConfig: () => ({ ...original.loadConfig(), VENICE_API_KEY: venice.apiKey }) };
});

import { DEFAULT_INSTRUCTIONS, type ContactRead } from '@squidbox/shared';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { runChosenModelTask } from '../src/ai/tasks.js';
import { findUserById } from '../src/users.js';

// Synthetic pages built to x.com's structure, never a real person's.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/x-profile/${name}`, import.meta.url), 'utf8');
const AVAILABLE = fixture('available.html');
const PAGES: Record<string, { status: number; body: string }> = {
  mayal: { status: 200, body: AVAILABLE },
  // Its photo on a host the server doesn't download from.
  elsewhere: {
    status: 200,
    body: AVAILABLE.replace('https://pbs.twimg.com/profile_images/1/abc_normal.jpg', 'https://evil.test/a.jpg'),
  },
  hidden: { status: 200, body: fixture('unavailable.html') },
  nobody: { status: 404, body: '' },
};
const BLUESKY = fixture('bluesky-profile.json');
// A JPEG's first bytes stand in for the photo: the server never decodes it.
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');

const auth = { authorization: `Bearer ${signAccessToken('u1')}` };
const fetchMock = vi.fn();

// What the writing model reads: other handles than the regexes and the place split.
const ASSISTANT_READ: ContactRead = {
  name: '',
  xHandle: '',
  blueskyHandle: 'other.bsky.social',
  onlyFansHandle: 'someoneelse',
  jffHandle: '',
  city: 'Squamish',
  state: '',
  country: 'Canada',
};

// x.com by handle, the photo, Bluesky; `overrides` by URL prefix.
function webAnswers(overrides: Record<string, () => Promise<Response> | Response> = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    const override = Object.entries(overrides).find(([prefix]) => url.startsWith(prefix));
    if (override) return override[1]();
    if (url.startsWith('https://x.com/')) {
      const page = PAGES[url.slice('https://x.com/'.length).toLowerCase()]!;
      return new Response(page.body, { status: page.status, headers: { 'content-type': 'text/html' } });
    }
    if (url.startsWith('https://pbs.twimg.com/') || url.startsWith('https://cdn.bsky.app/'))
      return new Response(JPEG, { headers: { 'content-type': 'image/jpeg' } });
    if (url.startsWith('https://public.api.bsky.app/'))
      return new Response(BLUESKY, { headers: { 'content-type': 'application/json' } });
    throw new Error(`unexpected fetch ${url}`);
  });
}

const requested = () => fetchMock.mock.calls.map(([url]) => url as string);

function signedInWith(features: string[]) {
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null, features } as any);
}

// The route's answer, and the server's log lines (as JSON) when `logs` is given.
async function call(
  payload: unknown,
  { headers = auth, logs }: { headers?: Record<string, string>; logs?: object[] } = {},
) {
  const app = await buildApp({
    logger: logs ? { level: 'info', stream: { write: (line: string) => void logs.push(JSON.parse(line)) } } : false,
  });
  return app.inject({ method: 'POST', url: '/api/v1/contacts/x-profile', headers, payload: payload as any });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  venice.apiKey = 'test-venice-key';
  signedInWith(['ai']);
  webAnswers();
  vi.mocked(runChosenModelTask).mockResolvedValue(ASSISTANT_READ);
});
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/v1/contacts/x-profile', () => {
  it('fills an ai account from the profile, the regexes over the assistant, the place split by it', async () => {
    const res = await call({ handle: 'MayaL' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'found',
      name: 'Maya Lindqvist 🌲',
      xHandle: 'mayal',
      blueskyHandle: 'maya.bsky.social',
      onlyFansHandle: 'mayal',
      jffHandle: 'mayal',
      city: 'Squamish',
      state: '',
      country: 'Canada',
      bio: "Trail runs and tide pools <3 · Maya's camera roll https://bsky.app/profile/Maya.bsky.social",
      website: 'https://onlyfans.com/mayal/c17',
      avatar: { base64: JPEG.toString('base64'), mimeType: 'image/jpeg' },
    });
    expect(requested()).toContain('https://pbs.twimg.com/profile_images/1/abc_400x400.jpg');
    const { messagesAsync, kind } = vi.mocked(runChosenModelTask).mock.calls[0]![0];
    expect(kind).toBe('writing');
    const [message] = await messagesAsync;
    expect(message!.content).toBe(
      DEFAULT_INSTRUCTIONS.contactXProfile.replace(
        '{profile}',
        [
          'Handle: @mayal',
          'Name: Maya Lindqvist 🌲',
          "Bio: Trail runs and tide pools <3 · Maya's camera roll https://bsky.app/profile/Maya.bsky.social",
          'Location: Squamish, BC',
          'Website: https://onlyfans.com/mayal/c17',
          'Links: https://onlyfans.com/mayal/c17, https://bsky.app/profile/Maya.bsky.social',
        ].join('\n'),
      ),
    );
  });

  it('fills an account without ai without the assistant, the location as the city', async () => {
    signedInWith([]);
    const res = await call({ handle: 'mayal' });
    expect(runChosenModelTask).not.toHaveBeenCalled();
    expect(res.json()).toMatchObject({
      status: 'found',
      name: 'Maya Lindqvist 🌲',
      onlyFansHandle: 'mayal',
      city: 'Squamish, BC',
      state: '',
      country: '',
    });
  });

  it('still answers the profile when the assistant fails', async () => {
    vi.mocked(runChosenModelTask).mockRejectedValue(new Error('Venice is down'));
    const res = await call({ handle: 'mayal' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'found', onlyFansHandle: 'mayal', city: 'Squamish, BC' });
  });

  it('does not ask the assistant on a server without a Venice key', async () => {
    venice.apiKey = undefined;
    const res = await call({ handle: 'mayal' });
    expect(res.statusCode).toBe(200);
    expect(runChosenModelTask).not.toHaveBeenCalled();
  });

  it('answers a profile X hides as unavailable, with nothing else fetched', async () => {
    const res = await call({ handle: 'hidden' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'unavailable', xHandle: 'hidden', name: '', bio: '', avatar: null });
    expect(requested()).toEqual(['https://x.com/hidden']);
  });

  it('answers a handle x.com does not know as notFound', async () => {
    const res = await call({ handle: 'nobody' });
    expect(res.json()).toMatchObject({ status: 'notFound', xHandle: 'nobody' });
  });

  it('answers a fetch of x.com that fails as failed, and logs it', async () => {
    webAnswers({ 'https://x.com/': () => Promise.reject(new TypeError('fetch failed')) });
    const logs: { msg?: string; reason?: string }[] = [];
    const res = await call({ handle: 'mayal' }, { logs });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'failed', xHandle: 'mayal', name: '' });
    expect(logs).toContainEqual(
      expect.objectContaining({ msg: 'From link: x.com gave no readable profile', reason: 'fetch failed' }),
    );
  });

  it('keeps the Bluesky handle and the rest when Bluesky does not know it', async () => {
    webAnswers({
      'https://public.api.bsky.app/': () =>
        new Response('{"error":"InvalidRequest","message":"Profile not found"}', { status: 400 }),
    });
    const res = await call({ handle: 'mayal' });
    expect(res.json()).toMatchObject({ status: 'found', blueskyHandle: 'maya.bsky.social', jffHandle: '' });
  });

  it('answers without the photo when it does not download', async () => {
    webAnswers({ 'https://pbs.twimg.com/': () => new Response('gone', { status: 404 }) });
    const res = await call({ handle: 'mayal' });
    expect(res.json()).toMatchObject({ status: 'found', name: 'Maya Lindqvist 🌲', avatar: null });
  });

  it('never fetches a profile photo on another host', async () => {
    signedInWith([]);
    const res = await call({ handle: 'elsewhere' });
    expect(res.json()).toMatchObject({ status: 'found', avatar: null });
    expect(requested().some((url) => url.startsWith('https://evil.test/'))).toBe(false);
  });

  it('takes a photo whose content-type has parameters', async () => {
    webAnswers({
      'https://pbs.twimg.com/': () => new Response(JPEG, { headers: { 'content-type': 'image/jpeg; charset=binary' } }),
    });
    const res = await call({ handle: 'mayal' });
    expect(res.json().avatar).toEqual({ base64: JPEG.toString('base64'), mimeType: 'image/jpeg' });
  });

  it('refuses a handle that is not an X handle, and a request without a token', async () => {
    expect((await call({ handle: 'mayal/status' })).statusCode).toBe(400);
    expect((await call({ handle: 'mayal' }, { headers: {} })).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
