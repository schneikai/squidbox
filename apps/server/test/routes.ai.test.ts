import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  toApiUser: (u: { id: string; email: string }) => ({ id: u.id, email: u.email }),
}));
// The test env has no Venice key; each test sets the one the routes see.
const venice = vi.hoisted(() => ({
  apiKey: undefined as string | undefined,
  allowed: undefined as string[] | undefined,
}));
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return { ...original, loadConfig: () => ({
      ...original.loadConfig(),
      VENICE_API_KEY: venice.apiKey,
      AI_ALLOWED_EMAILS: venice.allowed,
    }),
  };
});

import fixture from './fixtures/venice-models.json';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { clearCatalogCache } from '../src/ai/catalog.js';
import { findUserById } from '../src/users.js';

const auth = { authorization: `Bearer ${signAccessToken('u1')}` };
const eightTags = ['shower', 'wet hair', 'steam', 'back view', 'towel', 'morning light', 'tattoo', 'tiles'];
const fetchMock = vi.fn();

// Venice: the model list, and a chat reply per model.
function veniceAnswers({ catalogStatus = 200, balanceStatus = 200 } = {}) {
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
  venice.allowed = undefined;
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null } as any);
});
afterEach(() => vi.unstubAllGlobals());

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

describe('AI_ALLOWED_EMAILS', () => {
  it('answers 403 ai_not_allowed to an account it leaves out, before any Venice call', async () => {
    venice.allowed = ['owner@example.com'];
    for (const [method, url, body] of [
      ['GET', '/ai/models', undefined],
      ['GET', '/ai/balance', undefined],
      ['POST', '/ai/compare/writing', writing],
      ['POST', '/ai/compare/vision', vision],
    ] as const) {
      const res = await call(method, url, body);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('ai_not_allowed');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a listed account in, whatever the case of its email', async () => {
    venice.allowed = ['a@b.co'];
    vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'A@B.co', storageBucket: null } as any);
    veniceAnswers();
    expect((await call('GET', '/ai/models')).statusCode).toBe(200);
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

  it("returns what is left on the Venice account", async () => {
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
      response_format: { type: 'json_schema', json_schema: { name: 'tweets', strict: true } },
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
    });
    expect(kimi.messages[1]).toEqual({ role: 'user', content: 'Write 3 spicy tweets' });
    for (const body of [kimi, glm]) {
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body).not.toHaveProperty('max_tokens');
      expect(body.venice_parameters).not.toHaveProperty('disable_thinking');
    }
  });

  it('400 for a model Venice does not have', async () => {
    veniceAnswers();
    const res = await call('POST', '/ai/compare/writing', { ...writing, modelIds: ['kimi-k3', 'gone'] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unknown writing model: gone');
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

  it('413 for a body over the 2 MB limit', async () => {
    veniceAnswers();
    const base64 = 'A'.repeat(2 * 1024 * 1024 + 1);
    const res = await call('POST', '/ai/compare/vision', { ...vision, image: { ...vision.image, base64 } });
    expect(res.statusCode).toBe(413);
  });
});
