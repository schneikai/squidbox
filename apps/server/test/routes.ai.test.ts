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
// The db client is a stub here, so the persona read is mocked: no persona unless a test gives one.
vi.mock('../src/ai/persona.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ai/persona.js')>()),
  readPersona: vi.fn().mockResolvedValue(null),
  readFavorites: vi.fn().mockResolvedValue([]),
}));
// The chosen model likewise: the default unless a test chooses one.
vi.mock('../src/ai/modelChoices.js', async () => {
  const { DEFAULT_MODEL_IDS } = await import('@squidbox/shared');
  return {
    readChosenModelId: vi.fn(
      async (_db: unknown, _userId: string, kind: 'writing' | 'vision') => DEFAULT_MODEL_IDS[kind],
    ),
  };
});
// The instructions likewise: the defaults unless a test changes one.
vi.mock('../src/ai/instructions.js', async () => {
  const { resolveInstructions } = await import('@squidbox/shared');
  return { readInstructions: vi.fn().mockResolvedValue(resolveInstructions(null)) };
});
// The test env has no Venice key; each test sets the one the routes see.
const venice = vi.hoisted(() => ({ apiKey: undefined as string | undefined }));
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...original,
    loadConfig: () => ({
      ...original.loadConfig(),
      VENICE_API_KEY: venice.apiKey,
    }),
  };
});

import {
  ASSET_TAG_LIMITS,
  CHAT_LIMITS,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MODEL_IDS,
  resolveInstructions,
} from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import { writingFormatText } from '../src/ai/prompts.js';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { clearCatalogCache } from '../src/ai/catalog.js';
import { readInstructions } from '../src/ai/instructions.js';
import { readChosenModelId } from '../src/ai/modelChoices.js';
import { readFavorites, readPersona } from '../src/ai/persona.js';
import { findUserById } from '../src/users.js';

const auth = { authorization: `Bearer ${signAccessToken('u1')}` };
const tags = ['forest', 'morning fog', 'moss', 'trail', 'backpack', 'morning light', 'pine trees', 'creek'];
const fetchMock = vi.fn();

// Venice: the model list, and a chat reply per model.
const CHAT_REPLY = { reply: 'Here are three.', postOptions: ['one', 'two', 'three'] };

function veniceAnswers({
  catalogStatus = 200,
  balanceStatus = 200,
  chatStatus = 200,
  tags: replyTags = tags,
  chatReply = CHAT_REPLY as { reply: string; postOptions: string[] },
} = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api_keys/rate_limits')) {
      const body = {
        data: { balances: { USD: 4.58689693, DIEM: 0 }, nextEpochBegins: '2026-10-26T00:00:00.000Z', rateLimits: [] },
      };
      return new Response(JSON.stringify(balanceStatus === 200 ? body : { error: 'down' }), { status: balanceStatus });
    }
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify(catalogStatus === 200 ? fixture : { error: 'down' }), {
        status: catalogStatus,
      });
    }
    if (chatStatus !== 200) {
      return new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: chatStatus });
    }
    const { response_format } = JSON.parse(String(init!.body));
    const content = {
      tweets: { tweets: ['one', 'two', 'three'] },
      tags: { tags: replyTags },
      chat_reply: chatReply,
    }[response_format.json_schema.name as string];
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }),
    );
  });
}

const chatBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/chat/completions'))
    .map(([, init]) => JSON.parse(init.body));

const writing = { prompt: 'Write 3 posts about a sunrise hike', modelIds: ['kimi-k3', 'z-ai-glm-5-3'] };
const tagRequest = { image: { base64: 'AAAA', mimeType: 'image/jpeg' } };
const chatRequest = {
  context: {
    kind: 'draft',
    text: 'Fog on the trail',
    media: { photo: 2, video: 0 },
    tags: ['forest', 'morning fog'],
    mentions: ['@ridgeline.bsky.social'],
  },
  messages: [{ role: 'user', content: 'Write a caption for these photos' }],
};
const vision = {
  prompt: 'Tag what you see',
  image: { base64: 'AAAA', mimeType: 'image/jpeg' },
  modelIds: ['gemma-4-uncensored', 'qwen-3-6-plus'],
};

beforeEach(() => {
  vi.clearAllMocks();
  clearCatalogCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  venice.apiKey = 'test-venice-key';
  signedInWith(['ai', 'ai_admin']);
  vi.mocked(readPersona).mockResolvedValue(null);
  vi.mocked(readFavorites).mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

// The signed-in account u1, with these features.
function signedInWith(features: string[]) {
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null, features } as any);
}

async function call(method: 'GET' | 'POST', url: string, payload?: unknown, headers: Record<string, string> = auth) {
  const app = await buildApp({ logger: false });
  return app.inject({ method, url: `/api/v1${url}`, headers, payload: payload as any });
}

describe('without VENICE_API_KEY', () => {
  it('answers 503 ai_not_configured on every route, before any Venice call', async () => {
    venice.apiKey = undefined;
    for (const [method, url, body] of [
      ['GET', '/ai/models', undefined],
      ['GET', '/ai/balance', undefined],
      ['POST', '/ai/compare/writing', writing],
      ['POST', '/ai/compare/vision', vision],
      ['POST', '/ai/tags', tagRequest],
      ['POST', '/ai/chat', chatRequest],
    ] as const) {
      const res = await call(method, url, body);
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        error: { code: 'ai_not_configured', message: 'AI is not configured on the server' },
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('account features', () => {
  it('answers 403 ai_not_allowed to an account without ai, before any Venice call', async () => {
    signedInWith(['ai_admin']);
    for (const [method, url, body] of [
      ['GET', '/ai/models', undefined],
      ['GET', '/ai/balance', undefined],
      ['POST', '/ai/compare/writing', writing],
      ['POST', '/ai/compare/vision', vision],
      ['POST', '/ai/tags', tagRequest],
      ['POST', '/ai/chat', chatRequest],
    ] as const) {
      const res = await call(method, url, body);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('ai_not_allowed');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 403 ai_admin_not_allowed on the compares and the balance to an account without ai_admin', async () => {
    signedInWith(['ai']);
    for (const [method, url, body] of [
      ['GET', '/ai/balance', undefined],
      ['POST', '/ai/compare/writing', writing],
      ['POST', '/ai/compare/vision', vision],
    ] as const) {
      const res = await call(method, url, body);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('ai_admin_not_allowed');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets an account with ai only list the models, tag a photo and chat', async () => {
    signedInWith(['ai']);
    veniceAnswers();
    expect((await call('GET', '/ai/models')).statusCode).toBe(200);
    expect((await call('POST', '/ai/tags', tagRequest)).statusCode).toBe(200);
    const chat = await call('POST', '/ai/chat', chatRequest);
    expect(chat.statusCode).toBe(200);
    expect(chat.json()).toEqual(CHAT_REPLY);
  });
});

describe('GET /api/v1/ai/models', () => {
  it('401 without auth', async () => {
    expect((await call('GET', '/ai/models', undefined, {})).statusCode).toBe(401);
  });

  it("returns Venice's models as the app shows them", async () => {
    veniceAnswers();
    const res = await call('GET', '/ai/models');
    expect(res.statusCode).toBe(200);
    const { models } = res.json();
    expect(models).toHaveLength(fixture.data.length);
    expect(models.find((m: { id: string }) => m.id === 'z-ai-glm-5-3')).toEqual({
      id: 'z-ai-glm-5-3',
      name: 'GLM 5.3',
      supportsVision: false,
      isUncensored: false,
      costPerReplyUsd: expect.any(Number),
      costPer100PhotosUsd: null,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.venice.ai/api/v1/models');
  });

  it('502 ai_unavailable when the model list cannot be fetched', async () => {
    veniceAnswers({ catalogStatus: 500 });
    const res = await call('GET', '/ai/models');
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ai_unavailable');
  });
});

describe('GET /api/v1/ai/balance', () => {
  it('401 without auth', async () => {
    expect((await call('GET', '/ai/balance', undefined, {})).statusCode).toBe(401);
  });

  it('returns what is left on the Venice account', async () => {
    veniceAnswers();
    const res = await call('GET', '/ai/balance');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ usd: 4.58689693, diem: 0, nextResetAt: '2026-10-26T00:00:00.000Z' });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.venice.ai/api/v1/api_keys/rate_limits');
  });

  it('502 ai_unavailable when Venice does not answer it', async () => {
    veniceAnswers({ balanceStatus: 500 });
    const res = await call('GET', '/ai/balance');
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ai_unavailable');
  });
});

describe('POST /api/v1/ai/compare/writing', () => {
  it('asks each model for JSON tweets, on its own defaults', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/writing', writing);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: [
        { modelId: 'kimi-k3', tweets: ['one', 'two', 'three'] },
        { modelId: 'z-ai-glm-5-3', tweets: ['one', 'two', 'three'] },
      ],
    });
    const [kimi, glm] = chatBodies();
    expect(kimi).toMatchObject({
      model: 'kimi-k3',
      response_format: { type: 'json_schema', json_schema: { name: 'tweets', strict: true } },
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
    });
    expect(kimi.messages[1]).toEqual({ role: 'user', content: 'Write 3 posts about a sunrise hike' });
    for (const body of [kimi, glm]) {
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body).not.toHaveProperty('max_tokens');
      expect(body.venice_parameters).not.toHaveProperty('disable_thinking');
    }
  });

  it('answers a model Venice no longer has on its own card, and compares the others', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/writing', { ...writing, modelIds: ['gone', 'kimi-k3'] });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([
      { modelId: 'gone', error: 'Venice no longer offers this model' },
      { modelId: 'kimi-k3', tweets: ['one', 'two', 'three'] },
    ]);
    expect(chatBodies()).toHaveLength(1);
  });

  it("writes as the user's persona and favorites", async () => {
    veniceAnswers();
    vi.mocked(readPersona).mockResolvedValue({
      aboutYou: 'Outdoor photographer from Oregon.',
      contentTags: [],
      tone: 'Short and calm.',
      rules: [],
    });
    vi.mocked(readFavorites).mockResolvedValue(['First light on the ridge.']);
    const res = await call('POST', '/ai/compare/writing', writing);
    expect(res.statusCode).toBe(200);
    expect(readPersona).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(readFavorites).toHaveBeenCalledWith(expect.anything(), 'u1');
    for (const body of chatBodies()) {
      expect(body.messages[0].content).toContain('About the creator: Outdoor photographer from Oregon.');
      expect(body.messages[0].content).toContain('Their tone: Short and calm.');
      expect(body.messages[0].content).toContain('Write like these:\n---\nFirst light on the ridge.\n---');
    }
  });

  it("tells the models the user's writing instructions, then the fixed format", async () => {
    veniceAnswers();
    const mine = 'Write like a park ranger.';
    vi.mocked(readInstructions).mockResolvedValueOnce({ ...resolveInstructions(null), writing: mine });
    expect((await call('POST', '/ai/compare/writing', writing)).statusCode).toBe(200);
    expect(readInstructions).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'u1' }));
    for (const body of chatBodies()) {
      expect(body.messages[0].content.startsWith(mine)).toBe(true);
      expect(body.messages[0].content.endsWith(writingFormatText(DEFAULT_INSTRUCTIONS.writingFormat))).toBe(true);
    }
  });

  it('400 for the same model twice', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/writing', { ...writing, modelIds: ['kimi-k3', 'kimi-k3'] });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('compares any number of models', async () => {
    veniceAnswers();
    const modelIds = ['kimi-k3', 'grok-4-7', 'z-ai-glm-5-3', 'qwen-3-6-plus', 'venice-uncensored-1-2'];
    const res = await call('POST', '/ai/compare/writing', { ...writing, modelIds });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.map(({ modelId }: { modelId: string }) => modelId)).toEqual(modelIds);
  });

  it('429 on the 31st call in a minute', async () => {
    veniceAnswers();
    const app = await buildApp({ logger: false });
    const send = () =>
      app.inject({ method: 'POST', url: '/api/v1/ai/compare/writing', headers: auth, payload: writing });
    for (let i = 0; i < 30; i++) expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(429);
  });
});

describe('POST /api/v1/ai/compare/vision', () => {
  it('sends the prompt and the photo as a data URL and returns the tags per model', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/vision', vision);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: [
        { modelId: 'gemma-4-uncensored', tags },
        { modelId: 'qwen-3-6-plus', tags },
      ],
    });
    // The message's shape is the compare test's; here the request's prompt and photo reach it.
    const [gemma] = chatBodies();
    expect(gemma.messages[1].content).toEqual([
      { type: 'text', text: 'Tag what you see' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ]);
  });

  it("adds the persona's content themes after the prompt", async () => {
    veniceAnswers();
    vi.mocked(readPersona).mockResolvedValueOnce({
      aboutYou: '',
      tone: '',
      contentTags: ['landscape', 'hiking'],
      rules: [],
    });
    expect((await call('POST', '/ai/compare/vision', vision)).statusCode).toBe(200);
    expect(readPersona).toHaveBeenCalledWith(expect.anything(), 'u1');
    for (const body of chatBodies()) {
      expect(body.messages[1].content[1].text).toMatch(/^Creator's content themes: landscape, hiking\n\n/);
    }
  });

  it('400 without a prompt', async () => {
    veniceAnswers();
    expect((await call('POST', '/ai/compare/vision', { ...vision, prompt: ' ' })).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers a model that can't see photos on its own card", async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/vision', {
      ...vision,
      modelIds: ['gemma-4-uncensored', 'z-ai-glm-5-3'],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[1]).toEqual({ modelId: 'z-ai-glm-5-3', error: "This model can't see photos" });
  });

  it('413 for a body over the 2 MB limit', async () => {
    veniceAnswers();
    const base64 = 'A'.repeat(2 * 1024 * 1024 + 1);
    const res = await call('POST', '/ai/compare/vision', { ...vision, image: { ...vision.image, base64 } });
    expect(res.statusCode).toBe(413);
  });
});

describe('POST /api/v1/ai/tags', () => {
  it("tags the photo with the user's Photo tags instructions on the default vision model", async () => {
    veniceAnswers();
    const mine = 'Tag the trail, the weather and the light.';
    vi.mocked(readInstructions).mockResolvedValueOnce({ ...resolveInstructions(null), visionTagging: mine });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tags });
    expect(readChosenModelId).toHaveBeenCalledWith(expect.anything(), 'u1', 'vision');
    const [body, ...others] = chatBodies();
    expect(others).toHaveLength(0);
    expect(body.model).toBe(DEFAULT_MODEL_IDS.vision);
    expect(body.messages[0]).toEqual({ role: 'system', content: DEFAULT_INSTRUCTIONS.tagsSystem });
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: mine },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ]);
  });

  it("adds the persona's content themes after the instructions", async () => {
    veniceAnswers();
    vi.mocked(readPersona).mockResolvedValueOnce({ aboutYou: '', tone: '', contentTags: ['landscape'], rules: [] });
    expect((await call('POST', '/ai/tags', tagRequest)).statusCode).toBe(200);
    const [body] = chatBodies();
    expect(body.messages[1].content[0].text).toBe(DEFAULT_INSTRUCTIONS.visionTagging);
    expect(body.messages[1].content[1].text).toMatch(/^Creator's content themes: landscape\n\n/);
  });

  it("uses the user's chosen vision model", async () => {
    veniceAnswers();
    vi.mocked(readChosenModelId).mockResolvedValueOnce('qwen-3-6-plus');
    expect((await call('POST', '/ai/tags', tagRequest)).statusCode).toBe(200);
    expect(chatBodies().map((body) => body.model)).toEqual(['qwen-3-6-plus']);
  });

  it('502 ai_unavailable when the chosen model is gone or cannot see photos, before any chat', async () => {
    veniceAnswers();
    for (const [id, message] of [
      ['gone', 'Your vision model: Venice no longer offers this model'],
      ['z-ai-glm-5-3', "Your vision model: This model can't see photos"],
    ]) {
      vi.mocked(readChosenModelId).mockResolvedValueOnce(id!);
      const res = await call('POST', '/ai/tags', tagRequest);
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: { code: 'ai_unavailable', message } });
    }
    expect(chatBodies()).toHaveLength(0);
  });

  it('502 ai_unavailable with the reason when Venice fails', async () => {
    veniceAnswers({ chatStatus: 503 });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: { code: 'ai_unavailable', message: 'Model is busy' } });
  });

  it('502 ai_unavailable when the model list cannot be fetched', async () => {
    veniceAnswers({ catalogStatus: 500 });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('ai_unavailable');
  });

  it('drops tags over the length and keeps the first ones up to the limit', async () => {
    const long = 'x'.repeat(ASSET_TAG_LIMITS.tag + 1);
    const many = Array.from({ length: ASSET_TAG_LIMITS.tags + 5 }, (_, index) => `tag ${index}`);
    veniceAnswers({ tags: [long, ...many] });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(200);
    expect(res.json().tags).toEqual(many.slice(0, ASSET_TAG_LIMITS.tags));
  });

  it('502 ai_unavailable when every tag is over the length', async () => {
    veniceAnswers({ tags: ['x'.repeat(ASSET_TAG_LIMITS.tag + 1), 'y'.repeat(ASSET_TAG_LIMITS.tag + 10)] });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: { code: 'ai_unavailable', message: 'The model returned no usable tags' } });
  });

  it('drops a tag the asset could not store, such as one with a NUL character', async () => {
    veniceAnswers({ tags: ['fo\u0000g', 'moss'] });
    const res = await call('POST', '/ai/tags', tagRequest);
    expect(res.statusCode).toBe(200);
    expect(res.json().tags).toEqual(['moss']);
  });

  it('429 on the 61st call in a minute', async () => {
    veniceAnswers();
    const app = await buildApp({ logger: false });
    const send = () => app.inject({ method: 'POST', url: '/api/v1/ai/tags', headers: auth, payload: tagRequest });
    for (let i = 0; i < 60; i++) expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(429);
  });

  it('400 without a photo', async () => {
    veniceAnswers();
    expect((await call('POST', '/ai/tags', {})).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('413 for a body over the 2 MB limit', async () => {
    veniceAnswers();
    const base64 = 'A'.repeat(2 * 1024 * 1024 + 1);
    const res = await call('POST', '/ai/tags', { image: { ...tagRequest.image, base64 } });
    expect(res.statusCode).toBe(413);
  });
});

describe('POST /api/v1/ai/chat', () => {
  it('briefs the default writing model with the post, sends the transcript and returns its reply', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/chat', {
      ...chatRequest,
      messages: [
        ...chatRequest.messages,
        { role: 'assistant', reply: 'Three for you.', postOptions: ['a', 'b', 'c'] },
        { role: 'user', content: 'Shorter' },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(CHAT_REPLY);
    expect(readChosenModelId).toHaveBeenCalledWith(expect.anything(), 'u1', 'writing');
    const [body, ...others] = chatBodies();
    expect(others).toHaveLength(0);
    expect(body.model).toBe(DEFAULT_MODEL_IDS.writing);
    expect(body.response_format.json_schema.name).toBe('chat_reply');
    expect(body.response_format.json_schema.schema.properties.postOptions).not.toHaveProperty('maxItems');
    const [system, ...turns] = body.messages;
    expect(system.role).toBe('system');
    expect(system.content).toContain("What's in the photos (from image recognition): forest, morning fog");
    expect(system.content).toContain("People they've tagged in posts from the same album: @ridgeline.bsky.social");
    expect(system.content).toContain('Caption so far: "Fog on the trail"');
    expect(system.content).not.toContain(writingFormatText(DEFAULT_INSTRUCTIONS.writingFormat));
    expect(system.content).not.toContain(DEFAULT_INSTRUCTIONS.writing);
    expect(turns).toEqual([
      { role: 'user', content: 'Write a caption for these photos' },
      { role: 'assistant', content: '{"reply":"Three for you.","postOptions":["a","b","c"]}' },
      { role: 'user', content: 'Shorter' },
    ]);
  });

  it('returns a reply without options as it is', async () => {
    veniceAnswers({ chatReply: { reply: 'Sounds like a good trip.', postOptions: [] } });
    const res = await call('POST', '/ai/chat', chatRequest);
    expect(res.json()).toEqual({ reply: 'Sounds like a good trip.', postOptions: [] });
  });

  it("turns the model's reasoning down for the chat: low when it takes an effort, nothing when it can't reason", async () => {
    veniceAnswers();
    vi.mocked(readChosenModelId).mockResolvedValueOnce('deepseek-v4-1-flash-uncensored');
    await call('POST', '/ai/chat', chatRequest);
    vi.mocked(readChosenModelId).mockResolvedValueOnce('venice-uncensored-1-2');
    await call('POST', '/ai/chat', chatRequest);
    const [deepseek, venice] = chatBodies();
    expect(deepseek.reasoning_effort).toBe('low');
    expect(venice).not.toHaveProperty('reasoning_effort');
  });

  it("uses the user's chosen writing model", async () => {
    veniceAnswers();
    vi.mocked(readChosenModelId).mockResolvedValueOnce('z-ai-glm-5-3');
    expect((await call('POST', '/ai/chat', chatRequest)).statusCode).toBe(200);
    expect(chatBodies().map((body) => body.model)).toEqual(['z-ai-glm-5-3']);
  });

  it("uses the account's chat briefing", async () => {
    veniceAnswers();
    vi.mocked(readInstructions).mockResolvedValueOnce({
      ...resolveInstructions(null),
      chatContext: 'Post: {caption}\nTags: {tags}',
    });
    expect((await call('POST', '/ai/chat', chatRequest)).statusCode).toBe(200);
    const [body] = chatBodies();
    expect(body.messages[0].content).toBe('Post: "Fog on the trail"\nTags: forest, morning fog');
  });

  it('502 ai_unavailable when the chosen model is gone, before any chat', async () => {
    veniceAnswers();
    vi.mocked(readChosenModelId).mockResolvedValueOnce('gone');
    const res = await call('POST', '/ai/chat', chatRequest);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: { code: 'ai_unavailable', message: 'Your writing model: Venice no longer offers this model' },
    });
    expect(chatBodies()).toHaveLength(0);
  });

  it('502 ai_unavailable with the reason when Venice fails', async () => {
    veniceAnswers({ chatStatus: 503 });
    const res = await call('POST', '/ai/chat', chatRequest);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: { code: 'ai_unavailable', message: 'Model is busy' } });
  });

  it("400 when the last turn is the assistant's, a past reply has 11 options, or there are over 30 turns", async () => {
    veniceAnswers();
    const user = { role: 'user', content: 'Again' };
    const eleven = Array.from({ length: CHAT_LIMITS.posts + 1 }, (_, index) => `option ${index}`);
    expect(CHAT_LIMITS.messages).toBe(30);
    for (const messages of [
      [user, { role: 'assistant', reply: 'Hi', postOptions: [] }],
      [{ role: 'assistant', reply: '', postOptions: eleven }, user],
      [{ role: 'assistant', reply: 'x'.repeat(CHAT_LIMITS.message + 1), postOptions: [] }, user],
      Array.from({ length: CHAT_LIMITS.messages + 1 }, () => user),
    ]) {
      expect((await call('POST', '/ai/chat', { ...chatRequest, messages })).statusCode).toBe(400);
    }
    expect(chatBodies()).toHaveLength(0);
  });
});
