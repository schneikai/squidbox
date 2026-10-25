import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/venice-models.json';
import { checkTags, checkTweets, compareVision, compareWriting, normalizeTags } from '../src/ai/compare.js';
import type { CatalogEntry } from '../src/ai/catalog.js';

const access = { baseUrl: 'https://venice.test/api/v1', apiKey: 'test-key' };
const entries = fixture.data as CatalogEntry[];
const model = (id: string) => entries.find((entry) => entry.id === id)!;
const fetchMock = vi.fn();

// A chat completion whose content is `json`, for the model named in the request.
function replies(byModel: Record<string, unknown>) {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const { model: id } = JSON.parse(String(init.body));
    const reply = byModel[id];
    if (reply instanceof Response) return reply;
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }),
    );
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('normalizeTags', () => {
  it('trims, drops empty ones and case-insensitive duplicates, keeping the order', () => {
    expect(normalizeTags([' Shower ', 'shower', '', '  ', 'wet hair', 'SHOWER', 'steam'])).toEqual([
      'Shower',
      'wet hair',
      'steam',
    ]);
  });
});

describe('strict counts', () => {
  it('takes exactly 3 non-empty tweets', () => {
    expect(checkTweets([' a ', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(() => checkTweets(['a', 'b', ' '])).toThrow('Returned 2 tweets instead of 3');
  });

  it('takes exactly 8 tags after normalizing', () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(checkTags(eight)).toEqual(eight);
    expect(() => checkTags([...eight.slice(0, 7), 'A'])).toThrow('Returned 7 tags instead of 8');
  });
});

describe('compareWriting', () => {
  it("gives each model its result, and one model's failure stays on its own card", async () => {
    replies({
      'kimi-k3': { tweets: ['one', 'two', 'three'] },
      'grok-4-7': { tweets: ['one', 'two'] },
      'z-ai-glm-5-3': new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: 503 }),
    });
    const results = await compareWriting({
      ...access,
      prompt: 'Write',
      models: [model('kimi-k3'), model('grok-4-7'), model('z-ai-glm-5-3')],
    });
    expect(results).toEqual([
      { modelId: 'kimi-k3', tweets: ['one', 'two', 'three'] },
      { modelId: 'grok-4-7', error: 'Returned 2 tweets instead of 3' },
      { modelId: 'z-ai-glm-5-3', error: 'Model is busy' },
    ]);
  });

  it("says the reply couldn't be read when it isn't the JSON asked for", async () => {
    replies({ 'kimi-k3': 'thinking… here are your tweets', 'grok-4-7': { posts: [] } });
    const results = await compareWriting({ ...access, prompt: 'Write', models: [model('kimi-k3'), model('grok-4-7')] });
    expect(results).toEqual([
      { modelId: 'kimi-k3', error: "The reply couldn't be read" },
      { modelId: 'grok-4-7', error: "The reply couldn't be read" },
    ]);
  });

  it('reports a model Venice could not be reached for without the network details', async () => {
    replies({ 'kimi-k3': { tweets: ['a', 'b', 'c'] } });
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('socket hang up');
    });
    const results = await compareWriting({ ...access, prompt: 'Write', models: [model('grok-4-7'), model('kimi-k3')] });
    expect(results[0]).toEqual({ modelId: 'grok-4-7', error: "Couldn't reach Venice" });
    expect(results[1]).toEqual({ modelId: 'kimi-k3', tweets: ['a', 'b', 'c'] });
  });
});

describe('compareVision', () => {
  it('sends the photo to each model and checks the tag count', async () => {
    const eight = ['shower', 'wet hair', 'steam', 'back view', 'towel', 'morning light', 'tattoo', 'tiles'];
    replies({ 'gemma-4-uncensored': { tags: eight }, 'qwen-3-6-plus': { tags: [...eight, 'extra'] } });
    const results = await compareVision({
      ...access,
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      models: [model('gemma-4-uncensored'), model('qwen-3-6-plus')],
    });
    expect(results).toEqual([
      { modelId: 'gemma-4-uncensored', tags: eight },
      { modelId: 'qwen-3-6-plus', error: 'Returned 9 tags instead of 8' },
    ]);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
    expect(sent.max_tokens).toBe(200);
  });
});
