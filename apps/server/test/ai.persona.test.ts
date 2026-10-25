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
import { checkDraft, draftPersonaAsync } from '../src/ai/persona.js';
import { personaDraftMessages, writingMessages } from '../src/ai/prompts.js';
import type { CatalogEntry } from '../src/ai/catalog.js';

const entries = fixture.data as CatalogEntry[];
const kimi = entries.find((entry) => entry.id === 'kimi-k3')!;
const fetchMock = vi.fn();

const persona = {
  aboutYou: '29, gym guy from Berlin, a bit cocky.',
  contentTags: ['gym', 'shower'],
  tone: 'Short and cocky. Teases, never begs.',
  useEmoji: true,
  rules: ['Never use hashtags', 'Never call fans babe'],
  examplePosts: ["Leg day. You're welcome.", 'Sheets still warm.'],
};
const empty = { aboutYou: '', contentTags: [], tone: '', useEmoji: false, rules: [], examplePosts: [] };
const draft = { aboutYou: ' Gym guy. ', contentTags: ['gym', 'GYM', ' pov '], tone: ' Short. ', examplePostIndexes: [1] };

const systemOf = (messages: ReturnType<typeof writingMessages>) => messages[0]!.content as string;

function replies(content: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] })),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('writingMessages with a persona', () => {
  it('writes every field of a full persona into the system message', () => {
    const system = systemOf(writingMessages({ prompt: 'Write', persona }));
    expect(system).toContain('About the creator: 29, gym guy from Berlin, a bit cocky.');
    expect(system).toContain('Their content: gym, shower');
    expect(system).toContain('Their tone: Short and cocky. Teases, never begs.');
    expect(system).toContain('Use emoji, the way the example posts do.');
    expect(system).toContain('- Never use hashtags\n- Never call fans babe');
    expect(system).toContain("---\nLeg day. You're welcome.\n---\nSheets still warm.\n---");
  });

  it('leaves out the empty fields of a partly filled one', () => {
    const system = systemOf(writingMessages({ prompt: 'Write', persona: { ...empty, tone: 'Sweet.' } }));
    expect(system).toContain('Their tone: Sweet.');
    expect(system).toContain('No emoji.');
    expect(system).not.toContain('About the creator');
    expect(system).not.toContain('Their content');
    expect(system).not.toContain('Rules');
    expect(system).not.toContain('Example posts');
  });

  it('says only "Use emoji." without example posts to copy', () => {
    const system = systemOf(writingMessages({ prompt: 'Write', persona: { ...empty, useEmoji: true } }));
    expect(system).toContain('Use emoji.');
    expect(system).not.toContain('example posts');
  });

  it('has no persona text without one', () => {
    expect(systemOf(writingMessages({ prompt: 'Write', persona: null }))).not.toContain('emoji');
  });
});

describe('personaDraftMessages', () => {
  it('numbers the posts from 0, so the reply can pick them by index', () => {
    const [, user] = personaDraftMessages({ posts: ['first', 'second'] });
    expect(user!.content).toBe('Post 0:\nfirst\n\nPost 1:\nsecond');
  });
});

describe('checkDraft', () => {
  it('trims the texts and dedupes the tags case-insensitively', () => {
    expect(checkDraft(draft, 3)).toEqual({
      aboutYou: 'Gym guy.',
      contentTags: ['gym', 'pov'],
      tone: 'Short.',
      examplePostIndexes: [1],
    });
  });

  it('keeps the example posts within the posts sent, once each, at most 3', () => {
    expect(checkDraft({ ...draft, examplePostIndexes: [5, 0, 0, -1, 1.5, 2, 1, 3] }, 4).examplePostIndexes).toEqual([
      0, 2, 1,
    ]);
  });

  it('throws on an empty About you, Tone or tag list', () => {
    expect(() => checkDraft({ ...draft, aboutYou: ' ' }, 3)).toThrow('Returned no About you');
    expect(() => checkDraft({ ...draft, tone: '' }, 3)).toThrow('Returned no Tone');
    expect(() => checkDraft({ ...draft, contentTags: [' '] }, 3)).toThrow('Returned no tags');
  });
});

describe('draftPersonaAsync', () => {
  it('asks the model for the persona JSON and checks the reply', async () => {
    replies(draft);
    const result = await draftPersonaAsync({ posts: ['a', 'b'], model: kimi });
    expect(result).toEqual({ aboutYou: 'Gym guy.', contentTags: ['gym', 'pov'], tone: 'Short.', examplePostIndexes: [1] });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.model).toBe('kimi-k3');
    expect(body.response_format.json_schema.name).toBe('persona');
  });

  it('asks a model without response schemas in words', async () => {
    replies(draft);
    const plain = {
      ...kimi,
      model_spec: { ...kimi.model_spec, capabilities: { ...kimi.model_spec.capabilities, supportsResponseSchema: false } },
    };
    await draftPersonaAsync({ posts: ['a'], model: plain });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).not.toHaveProperty('response_format');
  });
});
