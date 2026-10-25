import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Venice's key and address as the client reads them from the config.
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...original,
    loadConfig: () => ({
      ...original.loadConfig(),
      VENICE_API_KEY: 'test-key',
      VENICE_BASE_URL: 'https://venice.test/api/v1',
    }),
  };
});

import fixture from './fixtures/venice-models.json';
import { checkTags, checkTweets, compareModels, visionTask, writingTask } from '../src/ai/compare.js';
import { visionMessages, writingMessages } from '../src/ai/prompts.js';
import type { CatalogEntry } from '../src/ai/catalog.js';

const entries = fixture.data as CatalogEntry[];
const model = (id: string) => entries.find((entry) => entry.id === id)!;
const fetchMock = vi.fn();

const compareWriting = (models: CatalogEntry[]) =>
  compareModels({ task: writingTask, messages: writingMessages({ prompt: 'Write', persona: null }), models });
const compareVision = (models: CatalogEntry[]) =>
  compareModels({
    task: visionTask,
    messages: visionMessages({ prompt: 'Tag it', imageDataUrl: 'data:image/jpeg;base64,AAAA' }),
    models,
  });

// A chat completion whose content is `json`, for the model named in the request.
function replies(byModel: Record<string, unknown>) {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const { model: id } = JSON.parse(String(init.body));
    const reply = byModel[id];
    if (reply instanceof Response) return reply;
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: 'stop', message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } },
        ],
      }),
    );
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('checking the replies', () => {
  it('takes exactly 3 non-empty tweets', () => {
    expect(checkTweets([' a ', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(() => checkTweets(['a', 'b', ' '])).toThrow('Returned 2 tweets instead of 3');
  });

  it('takes any number of tags, trimmed, without empty ones and case-insensitive duplicates, in order', () => {
    expect(checkTags([' Shower ', 'shower', '', '  ', 'wet hair', 'SHOWER', 'steam'])).toEqual([
      'Shower',
      'wet hair',
      'steam',
    ]);
    expect(() => checkTags([' ', ''])).toThrow('Returned no tags');
  });
});

describe('compareModels: writing', () => {
  it("gives each model its result, and one model's failure stays on its own card", async () => {
    replies({
      'kimi-k3': { tweets: ['one', 'two', 'three'] },
      'grok-4-7': { tweets: ['one', 'two'] },
      'z-ai-glm-5-3': new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: 503 }),
    });
    const results = await compareWriting([model('kimi-k3'), model('grok-4-7'), model('z-ai-glm-5-3')]);
    expect(results).toEqual([
      { modelId: 'kimi-k3', tweets: ['one', 'two', 'three'] },
      { modelId: 'grok-4-7', error: 'Returned 2 tweets instead of 3' },
      { modelId: 'z-ai-glm-5-3', error: 'Model is busy' },
    ]);
  });

  it("says the reply couldn't be read when it isn't the JSON asked for", async () => {
    replies({ 'kimi-k3': 'thinking… here are your tweets', 'grok-4-7': { posts: [] } });
    const results = await compareWriting([model('kimi-k3'), model('grok-4-7')]);
    expect(results).toEqual([
      { modelId: 'kimi-k3', error: "The reply couldn't be read" },
      { modelId: 'grok-4-7', error: "The reply couldn't be read" },
    ]);
  });

  it('asks a model without response schemas in words, and reads JSON wrapped in a fence', async () => {
    const plain = { ...model('kimi-k3'), id: 'plain' };
    plain.model_spec = {
      ...plain.model_spec,
      capabilities: { ...plain.model_spec.capabilities, supportsResponseSchema: false },
    };
    replies({
      plain: 'Here they are in {\"tweets\": [...]} form:\n```json\n{"tweets": ["a", "b", "c"]}\n```',
      'kimi-k3': { tweets: ['d', 'e', 'f'] },
    });
    const results = await compareWriting([plain, model('kimi-k3')]);
    expect(results).toEqual([
      { modelId: 'plain', tweets: ['a', 'b', 'c'] },
      { modelId: 'kimi-k3', tweets: ['d', 'e', 'f'] },
    ]);
    const [plainBody, kimiBody] = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(plainBody).not.toHaveProperty('response_format');
    expect(kimiBody.response_format.type).toBe('json_schema');
  });

  it("keeps the model's name out of Venice's error text, so the card stays blind", async () => {
    replies({
      'kimi-k3': new Response(JSON.stringify({ error: { message: 'Model KIMI-K3 is at capacity' } }), { status: 503 }),
      'grok-4-7': { tweets: ['a', 'b', 'c'] },
    });
    const [kimi] = await compareWriting([model('kimi-k3'), model('grok-4-7')]);
    expect(kimi).toEqual({ modelId: 'kimi-k3', error: 'Model the model is at capacity' });
  });

  it('reports a model Venice could not be reached for without the network details', async () => {
    replies({ 'kimi-k3': { tweets: ['a', 'b', 'c'] } });
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('socket hang up');
    });
    const results = await compareWriting([model('grok-4-7'), model('kimi-k3')]);
    expect(results[0]).toEqual({ modelId: 'grok-4-7', error: "Couldn't reach Venice" });
    expect(results[1]).toEqual({ modelId: 'kimi-k3', tweets: ['a', 'b', 'c'] });
  });
});

describe('compareModels: vision', () => {
  it('sends the photo to each model and takes as many tags as it gives', async () => {
    const tags = ['shower', 'wet hair', 'steam', 'back view', 'towel', 'morning light', 'tattoo', 'tiles'];
    replies({ 'gemma-4-uncensored': { tags }, 'qwen-3-6-plus': { tags: [...tags, 'extra'] } });
    const results = await compareVision([model('gemma-4-uncensored'), model('qwen-3-6-plus')]);
    expect(results).toEqual([
      { modelId: 'gemma-4-uncensored', tags },
      { modelId: 'qwen-3-6-plus', tags: [...tags, 'extra'] },
    ]);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.messages[1].content[0]).toEqual({ type: 'text', text: 'Tag it' });
    expect(sent.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
    expect(sent).not.toHaveProperty('max_tokens');
  });
});
