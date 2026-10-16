import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import sendAiMessageAsync from '../src/features/ai-suggestions/sendAiMessageAsync';

type Body = {
  model: string;
  temperature?: number;
  messages: { role: string; content: string }[];
  response_format: {
    type: string;
    json_schema: {
      strict: boolean;
      schema: {
        properties: { variations: { type: string; minItems: number; maxItems?: number; items: { type: string } } };
      };
    };
  };
};

const fetchMock = vi.fn<(url: string, init: { body: string }) => Promise<Response>>();

function reply(content: string | null, extra: Record<string, unknown> = {}, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content, ...extra }, finish_reason: finishReason }],
    }),
  );
}

function sentBodies(): Body[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
}

const firstRequest = [{ role: 'user' as const, content: 'Create some caption ideas' }];
const correction = [
  ...firstRequest,
  { role: 'assistant' as const, variations: ['Sunday reset', 'Coffee first', 'Slow morning'] },
  { role: 'user' as const, content: 'Make them shorter and add an emoji' },
];

describe('sendAiMessageAsync', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EXPO_PUBLIC_OPENAI_API_KEY', 'sk-test-not-real');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('asks for at least as many variations in the schema as in the prompt, without a temperature', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"variations":["One","Two","Three"]}'));

    await expect(sendAiMessageAsync(firstRequest, ['An old post'], 'gpt-4o', 'Be flirty.')).resolves.toEqual([
      'One',
      'Two',
      'Three',
    ]);

    const [body] = sentBodies();
    expect(body.model).toBe('gpt-4o');
    expect(body).not.toHaveProperty('temperature');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    const { minItems } = body.response_format.json_schema.schema.properties.variations;
    expect(minItems).toBeGreaterThan(1);

    const system = body.messages[0];
    expect(system.role).toBe('system');
    expect(system.content.startsWith('Be flirty.')).toBe(true);
    expect(system.content).toContain('1. An old post');
    expect(system.content.indexOf('An old post')).toBeLessThan(system.content.indexOf('How to reply'));
    expect(system.content).toContain(`at least ${minItems}`);
    expect(system.content).toMatch(/never just one post/);
    expect(body.messages.slice(1)).toEqual(firstRequest);
  });

  it('asks a batch for exactly that many independent posts, without the chat rules', async () => {
    const tweets = Array.from({ length: 10 }, (_, i) => `Tweet ${i + 1}`);
    fetchMock.mockResolvedValueOnce(reply(JSON.stringify({ variations: tweets })));

    await expect(
      sendAiMessageAsync([{ role: 'user', content: 'Random tweets' }], [], 'gpt-4o', null, { batchSize: 10 }),
    ).resolves.toEqual(tweets);

    const [body] = sentBodies();
    const { minItems, maxItems } = body.response_format.json_schema.schema.properties.variations;
    expect([minItems, maxItems]).toEqual([10, 10]);
    const system = body.messages[0].content;
    expect(system).toContain('exactly 10 posts');
    expect(system).toMatch(/not alternatives/);
    expect(system).not.toMatch(/at least \d/);
    expect(system).not.toMatch(/never just one post/);
  });

  it('drops empty and whitespace items and trims the rest', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"variations":[" One ","Two","","   ","Three\\n"]}'));
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).resolves.toEqual(['One', 'Two', 'Three']);

    // A chat reply needs a set to choose from even after the empty items are gone.
    fetchMock.mockResolvedValueOnce(reply('{"variations":["One","",""]}'));
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow("The AI's reply couldn't be read");
  });

  it('explains replies that were cut off or filtered', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"variations":["Cut', {}, 'length'));
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow(
      'The reply was too long and got cut off. Please try again, or ask for something shorter.',
    );

    fetchMock.mockResolvedValueOnce(reply(null, {}, 'content_filter'));
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow(
      "The reply was blocked by OpenAI's content filter.",
    );
  });

  it('sends previous variations in the reply shape and keeps the system prompt stable between turns', async () => {
    fetchMock
      .mockResolvedValueOnce(reply('{"variations":["Sunday reset","Coffee first","Slow morning"]}'))
      .mockResolvedValueOnce(reply('{"variations":["Reset ☕","Coffee 1st ✨","Slow ✌️"]}'));
    const referencePosts = ['First old post', 'Second old post'];

    await sendAiMessageAsync(firstRequest, referencePosts, 'gpt-4o');
    await expect(sendAiMessageAsync(correction, referencePosts, 'gpt-4o')).resolves.toHaveLength(3);

    const [first, second] = sentBodies();
    expect(second.messages[0]).toEqual(first.messages[0]);
    expect(second.messages.slice(1)).toEqual([
      firstRequest[0],
      { role: 'assistant', content: '{"variations":["Sunday reset","Coffee first","Slow morning"]}' },
      correction[2],
    ]);
  });

  it('leaves the style reference out when no posts are given', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"variations":["One","Two","Three"]}'));
    await sendAiMessageAsync(firstRequest, [], 'gpt-4o');
    expect(sentBodies()[0].messages[0].content).not.toContain('reference for tone');
  });

  it('fails with a clear error when the reply is malformed', async () => {
    for (const content of ['{"variations":["Cut off', '{"variations":[]}', '{"captions":["One"]}', null]) {
      fetchMock.mockResolvedValueOnce(reply(content));
      await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow("The AI's reply couldn't be read");
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('surfaces API errors and refusals', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), { status: 401 }),
    );
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow('Incorrect API key provided');

    fetchMock.mockResolvedValueOnce(reply(null, { refusal: "I can't help with that." }));
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow(
      "The AI declined: I can't help with that.",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses to call the API without a key', async () => {
    vi.stubEnv('EXPO_PUBLIC_OPENAI_API_KEY', '');
    await expect(sendAiMessageAsync(firstRequest, [], 'gpt-4o')).rejects.toThrow('OpenAI API key not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
