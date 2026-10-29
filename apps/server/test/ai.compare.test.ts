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

import { CHAT_LIMITS, DEFAULT_INSTRUCTIONS } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import { compareModels } from '../src/ai/compare.js';
import {
  chatTask,
  checkChatReply,
  checkTags,
  checkTweets,
  fitTags,
  runTask,
  visionTask,
  writingTask,
} from '../src/ai/tasks.js';
import { VeniceError, VeniceUnavailableError } from '../src/ai/venice.js';
import { visionMessages, writingMessages } from '../src/ai/prompts.js';
import type { CatalogEntry } from '../src/ai/catalog.js';

const entries = fixture.data as CatalogEntry[];
const model = (id: string) => entries.find((entry) => entry.id === id)!;
const fetchMock = vi.fn();

const compareWriting = (models: CatalogEntry[]) =>
  compareModels({
    task: writingTask,
    messages: writingMessages({
      prompt: 'Write',
      persona: null,
      favorites: [],
      instructions: DEFAULT_INSTRUCTIONS,
    }),
    models,
  });
const compareVision = (models: CatalogEntry[]) =>
  compareModels({
    task: visionTask,
    messages: visionMessages({
      prompt: 'Tag it',
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
    }),
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

describe('visionMessages', () => {
  it('sends the Photo tags briefing as the system message, then the photo', () => {
    const [system, user] = visionMessages({
      prompt: DEFAULT_INSTRUCTIONS.visionTagging,
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
    });
    expect(system!.role).toBe('system');
    expect(system!.content).toMatch(/^You generate tags for images/);
    expect(system!.content).toMatch(/Return only a valid JSON object containing a "tags" array/);
    expect(system!.content).not.toContain('{themes}');
    expect(system!.content).not.toContain("Creator's content themes");
    expect(system!.content).not.toMatch(/\n\n\n/);
    expect(user!.content).toEqual([{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }]);
  });

  it("fills in the creator's content themes when they have any", () => {
    const [system] = visionMessages({
      prompt: DEFAULT_INSTRUCTIONS.visionTagging,
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      contentTags: ['landscape', 'golden hour'],
    });
    expect(system!.content).toContain(
      "Creator's content themes: landscape, golden hour. Treat these themes as a creative starting point",
    );
  });

  it("uses the user's own Photo tags text, an unknown placeholder left as it is", () => {
    const [system] = visionMessages({
      prompt: 'Think of {themes} and {other}.',
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      contentTags: ['moss', 'fog'],
    });
    expect(system).toEqual({ role: 'system', content: 'Think of moss, fog and {other}.' });
  });
});

describe('checking the replies', () => {
  it('takes exactly 3 non-empty tweets', () => {
    expect(checkTweets([' a ', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(() => checkTweets(['a', 'b', ' '])).toThrow('Returned 2 tweets instead of 3');
  });

  it('takes a chat reply trimmed and cut to fit, without empty options, the first 10 of them', () => {
    const many = Array.from({ length: 12 }, (_, index) => `post ${index}`);
    expect(checkChatReply({ reply: ' Hi ', postOptions: [' a ', ' ', ...many] })).toEqual({
      reply: 'Hi',
      postOptions: ['a', ...many.slice(0, 9)],
    });
    expect(checkChatReply({ reply: 'Sounds good.', postOptions: [] })).toEqual({
      reply: 'Sounds good.',
      postOptions: [],
    });
    expect(checkChatReply({ reply: '', postOptions: ['a'] })).toEqual({ reply: '', postOptions: ['a'] });
    const long = 'x'.repeat(CHAT_LIMITS.message + 5);
    expect(checkChatReply({ reply: long, postOptions: [long] })).toEqual({
      reply: long.slice(0, CHAT_LIMITS.message),
      postOptions: [long.slice(0, CHAT_LIMITS.message)],
    });
    expect(() => checkChatReply({ reply: ' ', postOptions: [' '] })).toThrow(
      new VeniceError('Returned neither a reply nor posts'),
    );
  });

  it('takes any number of tags, trimmed, without empty ones and case-insensitive duplicates, in order', () => {
    expect(checkTags([' Forest ', 'forest', '', '  ', 'morning fog', 'FOREST', 'moss'])).toEqual([
      'Forest',
      'morning fog',
      'moss',
    ]);
    expect(() => checkTags([' ', ''])).toThrow('Returned no tags');
  });

  it("keeps a photo's tags that fit the asset: up to the length, the first ones up to the count", () => {
    const many = Array.from({ length: 25 }, (_, index) => `tag ${index}`);
    expect(fitTags(['x'.repeat(41), ' moss ', ...many])).toEqual(['moss', ...many.slice(0, 19)]);
    expect(fitTags(['fo\u0000g', 'moss'])).toEqual(['moss']);
    expect(() => fitTags(['x'.repeat(41), 'a\u0000'])).toThrow(new VeniceError('The model returned no usable tags'));
  });
});

describe('runTask', () => {
  const messages = visionMessages({
    prompt: 'Tag it',
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
  });

  it("resolves the model's reply once it passes the task's check", async () => {
    replies({ 'gemma-4-uncensored': { tags: [' moss ', 'Moss', 'fog'] } });
    await expect(runTask({ task: visionTask, messages, model: model('gemma-4-uncensored') })).resolves.toEqual({
      tags: ['moss', 'fog'],
    });
  });

  it("runs a chat reply on the model's own defaults, and keeps an unreadable one as its text", async () => {
    const chat = [{ role: 'user' as const, content: 'Hi' }];
    replies({ 'deepseek-v4-1-flash-uncensored': 'Sure, tell me about the trip.' });
    await expect(
      runTask({ task: chatTask, messages: chat, model: model('deepseek-v4-1-flash-uncensored') }),
    ).resolves.toEqual({ reply: 'Sure, tell me about the trip.', postOptions: [] });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent).not.toHaveProperty('reasoning_effort');
    expect(sent).not.toHaveProperty('reasoning');
    expect(sent.venice_parameters).toEqual({ include_venice_system_prompt: false, strip_thinking_response: true });
    expect(sent.response_format.json_schema.name).toBe('chat_reply');
    expect(sent.response_format.json_schema.schema.properties.postOptions).not.toHaveProperty('maxItems');
  });

  it('reads a chat reply that misses the schema as far as it goes', async () => {
    const run = async (content: string) => {
      replies({ 'deepseek-v4-1-flash-uncensored': content });
      return runTask({
        task: chatTask,
        messages: [{ role: 'user', content: 'Hi' }],
        model: model('deepseek-v4-1-flash-uncensored'),
      });
    };
    await expect(run('{"reply":"Sounds good."}')).resolves.toEqual({ reply: 'Sounds good.', postOptions: [] });
    await expect(run('{"reply":"Here.","postOptions":null}')).resolves.toEqual({ reply: 'Here.', postOptions: [] });
    await expect(run('{"reply":"Here.","postOptions":"one post"}')).resolves.toEqual({
      reply: 'Here.',
      postOptions: [],
    });
    await expect(run('{"reply":"Two.","postOptions":["a",3,"b"]}')).resolves.toEqual({
      reply: 'Two.',
      postOptions: ['a', 'b'],
    });
    await expect(run('{"message":"Hi"}')).resolves.toEqual({ reply: '{"message":"Hi"}', postOptions: [] });
  });

  it('fails an unreadable reply of any other task', async () => {
    replies({ 'deepseek-v4-1-flash-uncensored': 'not json' });
    const writing = runTask({
      task: writingTask,
      messages: [{ role: 'user', content: 'Write' }],
      model: model('deepseek-v4-1-flash-uncensored'),
    });
    await expect(writing).rejects.toThrow("The reply couldn't be read");
  });

  it('throws the VeniceError a compare shows on the model card', async () => {
    replies({ 'gemma-4-uncensored': { tags: [' '] } });
    const failed = runTask({ task: visionTask, messages, model: model('gemma-4-uncensored') });
    await expect(failed).rejects.toBeInstanceOf(VeniceError);
    await expect(failed).rejects.toThrow('Returned no tags');
  });

  it("tells Venice not answering (an error answer, a timeout) from the model's own failure (a refusal)", async () => {
    const run = () => runTask({ task: visionTask, messages, model: model('gemma-4-uncensored') });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Down' } }), { status: 503 }));
    await expect(run()).rejects.toEqual(new VeniceUnavailableError('Down'));
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const timedOut = run();
    await expect(timedOut).rejects.toBeInstanceOf(VeniceUnavailableError);
    await expect(timedOut).rejects.toThrow('Venice took too long to answer');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'No.' } }] })),
    );
    const refused = run();
    await expect(refused).rejects.toBeInstanceOf(VeniceError);
    await expect(refused).rejects.not.toBeInstanceOf(VeniceUnavailableError);
  });
});

describe('compareModels: writing', () => {
  it("gives each model its result, and one model's failure stays on its own card", async () => {
    replies({
      'kimi-k3': { reply: '', postOptions: ['one', 'two', 'three'] },
      'grok-4-7': { reply: '', postOptions: ['one', 'two'] },
      'z-ai-glm-5-3': new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: 503 }),
    });
    const results = await compareWriting([model('kimi-k3'), model('grok-4-7'), model('z-ai-glm-5-3')]);
    expect(results).toEqual([
      { modelId: 'kimi-k3', reply: '', postOptions: ['one', 'two', 'three'] },
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
      plain: 'Here they are:\n```json\n{"reply": "", "postOptions": ["a", "b", "c"]}\n```',
      'kimi-k3': { reply: '', postOptions: ['d', 'e', 'f'] },
    });
    const results = await compareWriting([plain, model('kimi-k3')]);
    expect(results).toEqual([
      { modelId: 'plain', reply: '', postOptions: ['a', 'b', 'c'] },
      { modelId: 'kimi-k3', reply: '', postOptions: ['d', 'e', 'f'] },
    ]);
    const [plainBody, kimiBody] = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(plainBody).not.toHaveProperty('response_format');
    expect(kimiBody.response_format.type).toBe('json_schema');
  });

  it("keeps the model's name out of Venice's error text, so the card stays blind", async () => {
    replies({
      'kimi-k3': new Response(JSON.stringify({ error: { message: 'Model KIMI-K3 is at capacity' } }), { status: 503 }),
      'grok-4-7': { reply: '', postOptions: ['a', 'b', 'c'] },
    });
    const [kimi] = await compareWriting([model('kimi-k3'), model('grok-4-7')]);
    expect(kimi).toEqual({ modelId: 'kimi-k3', error: 'Model the model is at capacity' });
  });

  it('reports a model Venice could not be reached for without the network details', async () => {
    replies({ 'kimi-k3': { reply: '', postOptions: ['a', 'b', 'c'] } });
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('socket hang up');
    });
    const results = await compareWriting([model('grok-4-7'), model('kimi-k3')]);
    expect(results[0]).toEqual({ modelId: 'grok-4-7', error: "Couldn't reach Venice" });
    expect(results[1]).toEqual({ modelId: 'kimi-k3', reply: '', postOptions: ['a', 'b', 'c'] });
  });
});

describe('compareModels: vision', () => {
  it('sends the photo to each model and takes as many tags as it gives', async () => {
    const tags = ['forest', 'morning fog', 'moss', 'trail', 'backpack', 'morning light', 'pine trees', 'creek'];
    replies({ 'gemma-4-uncensored': { tags }, 'qwen-3-6-plus': { tags: [...tags, 'extra'] } });
    const results = await compareVision([model('gemma-4-uncensored'), model('qwen-3-6-plus')]);
    expect(results).toEqual([
      { modelId: 'gemma-4-uncensored', tags },
      { modelId: 'qwen-3-6-plus', tags: [...tags, 'extra'] },
    ]);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'Tag it' });
    expect(sent.messages[1].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
    expect(sent).not.toHaveProperty('max_tokens');
  });
});
