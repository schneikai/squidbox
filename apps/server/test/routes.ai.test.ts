import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  toApiUser: (u: { id: string; email: string }) => ({ id: u.id, email: u.email }),
}));
// The test env has no Venice key; each test sets the one the routes see.
const venice = vi.hoisted(() => ({ apiKey: undefined as string | undefined }));
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return { ...original, loadConfig: () => ({ ...original.loadConfig(), VENICE_API_KEY: venice.apiKey }) };
});

import { VISION_REQUEST_BODY_LIMIT } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { clearCatalogCache } from '../src/ai/catalog.js';
import { findUserById } from '../src/users.js';

const auth = { authorization: `Bearer ${signAccessToken('u1')}` };
const eightTags = ['shower', 'wet hair', 'steam', 'back view', 'towel', 'morning light', 'tattoo', 'tiles'];
const fetchMock = vi.fn();

// Venice: the model list, and a chat reply per model.
function veniceAnswers({ catalogStatus = 200 } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify(catalogStatus === 200 ? fixture : { error: 'down' }), {
        status: catalogStatus,
      });
    }
    const { response_format } = JSON.parse(String(init!.body));
    const content =
      response_format.json_schema.name === 'tweets' ? { tweets: ['one', 'two', 'three'] } : { tags: eightTags };
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }),
    );
  });
}

const chatBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/chat/completions'))
    .map(([, init]) => JSON.parse(init.body));

const writing = { prompt: 'Write 3 spicy tweets', modelIds: ['kimi-k3', 'z-ai-glm-5-3'] };
const vision = { image: { base64: 'AAAA', mimeType: 'image/jpeg' }, modelIds: ['gemma-4-uncensored', 'qwen-3-6-plus'] };

beforeEach(() => {
  vi.clearAllMocks();
  clearCatalogCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  venice.apiKey = 'test-venice-key';
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null } as any);
});
afterEach(() => vi.unstubAllGlobals());

async function call(method: 'GET' | 'POST', url: string, payload?: unknown, headers: Record<string, string> = auth) {
  const app = await buildApp({ logger: false });
  return app.inject({ method, url: `/api/v1${url}`, headers, payload: payload as any });
}

describe('without VENICE_API_KEY', () => {
  it('answers 503 ai_not_configured on all three routes, before any Venice call', async () => {
    venice.apiKey = undefined;
    for (const [method, url, body] of [
      ['GET', '/ai/models', undefined],
      ['POST', '/ai/compare/writing', writing],
      ['POST', '/ai/compare/vision', vision],
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

describe('POST /api/v1/ai/compare/writing', () => {
  it('asks each model for JSON tweets, with the lowest reasoning effort it takes', async () => {
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
      max_tokens: 600,
      reasoning_effort: 'none',
      response_format: { type: 'json_schema', json_schema: { name: 'tweets', strict: true } },
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true, disable_thinking: true },
    });
    expect(kimi.messages[1]).toEqual({ role: 'user', content: 'Write 3 spicy tweets' });
    expect(glm).not.toHaveProperty('reasoning_effort');
  });

  it('400 for a model Venice does not have', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/writing', { ...writing, modelIds: ['kimi-k3', 'gone'] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unknown writing model: gone');
  });

  it('400 for more than 4 models', async () => {
    veniceAnswers();
    const modelIds = ['kimi-k3', 'grok-4-7', 'z-ai-glm-5-3', 'qwen-3-6-plus', 'gemma-4-uncensored'];
    expect((await call('POST', '/ai/compare/writing', { ...writing, modelIds })).statusCode).toBe(400);
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
  it('sends the photo as a data URL and returns 8 tags per model', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/vision', vision);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: [
        { modelId: 'gemma-4-uncensored', tags: eightTags },
        { modelId: 'qwen-3-6-plus', tags: eightTags },
      ],
    });
    const [gemma] = chatBodies();
    expect(gemma.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
  });

  it("400 for a model that can't see photos", async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/vision', {
      ...vision,
      modelIds: ['gemma-4-uncensored', 'z-ai-glm-5-3'],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe("GLM 5.3 can't see photos");
  });

  it('413 for a body over the limit', async () => {
    veniceAnswers();
    const base64 = 'A'.repeat(VISION_REQUEST_BODY_LIMIT + 1);
    const res = await call('POST', '/ai/compare/vision', { ...vision, image: { ...vision.image, base64 } });
    expect(res.statusCode).toBe(413);
  });
});
