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

import { DEFAULT_INSTRUCTIONS } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import { checkDraft, draftPersonaAsync } from '../src/ai/persona.js';
import { DRAFT_FORMAT, personaDraftMessages, WRITING_FORMAT, writingMessages } from '../src/ai/prompts.js';
import type { CatalogEntry } from '../src/ai/catalog.js';

const entries = fixture.data as CatalogEntry[];
const kimi = entries.find((entry) => entry.id === 'kimi-k3')!;
const fetchMock = vi.fn();

const persona = {
  aboutYou: '34, outdoor photographer from Oregon, a bit dry.',
  contentTags: ['hiking', 'forest'],
  tone: 'Short and calm. Never salesy.',
  rules: ['Never use hashtags', 'Never name the exact spot'],
};
const favorites = ['First light on the ridge.', 'Fog on the lake.'];
const empty = { aboutYou: '', contentTags: [], tone: '', rules: [] };
const draft = {
  aboutYou: ' Outdoor guy. ',
  contentTags: ['hiking', 'HIKING', ' forest '],
  tone: ' Short. ',
  examplePostIndexes: [1],
};

const systemOf = (messages: ReturnType<typeof writingMessages>) => messages[0]!.content as string;

function replies(content: unknown) {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }),
    ),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('writingMessages with a persona', () => {
  it('writes every field of a full persona and the favorites into the system message', () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS.writing, prompt: 'Write', persona, favorites }),
    );
    expect(system).toContain('About the creator: 34, outdoor photographer from Oregon, a bit dry.');
    expect(system).toContain('Their content: hiking, forest');
    expect(system).toContain('Their tone: Short and calm. Never salesy.');
    expect(system).not.toContain('emoji');
    expect(system).toContain('- Never use hashtags\n- Never name the exact spot');
    expect(system).toContain(
      'Example posts they wrote. Write like these:\n---\nFirst light on the ridge.\n---\nFog on the lake.\n---',
    );
    // In the screen's order: About you, Tone, Your content, Rules.
    const order = ['About the creator', 'Their tone', 'Their content', 'Rules', 'Example posts'];
    const at = order.map((text) => system.indexOf(text));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('sends the favorites without a saved persona', () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS.writing, prompt: 'Write', persona: null, favorites }),
    );
    expect(system).toContain('Write like these:\n---\nFirst light on the ridge.');
    expect(system).not.toContain('emoji');
  });

  it('leaves out the empty fields of a partly filled one', () => {
    const system = systemOf(
      writingMessages({
        instructions: DEFAULT_INSTRUCTIONS.writing,
        prompt: 'Write',
        persona: { ...empty, tone: 'Sweet.' },
        favorites: [],
      }),
    );
    expect(system).toContain('Their tone: Sweet.');
    expect(system).not.toContain('About the creator');
    expect(system).not.toContain('Their content');
    expect(system).not.toContain('Rules');
    expect(system).not.toContain('Example posts');
  });

  it("starts with the user's writing instructions and ends with the fixed reply format", () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS.writing, prompt: 'Write', persona, favorites }),
    );
    expect(system.startsWith(DEFAULT_INSTRUCTIONS.writing)).toBe(true);
    expect(system.endsWith(WRITING_FORMAT)).toBe(true);
    const mine = 'Write like a ranger. Reply in prose, one paragraph.';
    const changed = systemOf(writingMessages({ instructions: mine, prompt: 'Write', persona, favorites }));
    expect(changed.startsWith(mine)).toBe(true);
    expect(changed).not.toContain(DEFAULT_INSTRUCTIONS.writing);
    expect(changed).toContain('About the creator');
    expect(changed.endsWith(WRITING_FORMAT)).toBe(true);
  });

  it('has no persona text without one or favorites', () => {
    expect(
      systemOf(
        writingMessages({ instructions: DEFAULT_INSTRUCTIONS.writing, prompt: 'Write', persona: null, favorites: [] }),
      ),
    ).toBe(`${DEFAULT_INSTRUCTIONS.writing}\n\n${WRITING_FORMAT}`);
  });
});

describe('personaDraftMessages', () => {
  it("is the user's instructions, then the fixed reply format, with or without a change", () => {
    const [system] = personaDraftMessages({ posts: ['first'], instructions: DEFAULT_INSTRUCTIONS.personaDraft });
    expect(system!.content).toBe(`${DEFAULT_INSTRUCTIONS.personaDraft}\n\n${DRAFT_FORMAT}`);
    const mine = 'Describe me in prose, no JSON.';
    const [changed] = personaDraftMessages({ posts: ['first'], instructions: mine });
    expect(changed!.content).toBe(`${mine}\n\n${DRAFT_FORMAT}`);
  });

  it('numbers the posts from 0, so the reply can pick them by index', () => {
    const [, user] = personaDraftMessages({
      posts: ['first', 'second'],
      instructions: DEFAULT_INSTRUCTIONS.personaDraft,
    });
    expect(user!.content).toBe('Post 0:\nfirst\n\nPost 1:\nsecond');
  });
});

describe('checkDraft', () => {
  it('trims the texts and dedupes the tags case-insensitively', () => {
    expect(checkDraft(draft, 3)).toEqual({
      aboutYou: 'Outdoor guy.',
      contentTags: ['hiking', 'forest'],
      tone: 'Short.',
      examplePostIndexes: [1],
    });
  });

  it('keeps the example posts within the posts sent, once each, at most 3', () => {
    expect(checkDraft({ ...draft, examplePostIndexes: [5, 0, 0, -1, 1.5, 2, 1, 3] }, 4).examplePostIndexes).toEqual([
      0, 2, 1,
    ]);
  });

  it('throws on an empty About you or Tone', () => {
    expect(() => checkDraft({ ...draft, aboutYou: ' ' }, 3)).toThrow('Returned no About you');
    expect(() => checkDraft({ ...draft, tone: '' }, 3)).toThrow('Returned no Tone');
  });

  it('takes a reply without tags, which the user adds', () => {
    expect(checkDraft({ ...draft, contentTags: [' '] }, 3).contentTags).toEqual([]);
  });
});

describe('draftPersonaAsync', () => {
  it('asks the model for the persona JSON and checks the reply', async () => {
    replies(draft);
    const result = await draftPersonaAsync({
      posts: ['a', 'b'],
      instructions: DEFAULT_INSTRUCTIONS.personaDraft,
      model: kimi,
    });
    expect(result).toEqual({
      aboutYou: 'Outdoor guy.',
      contentTags: ['hiking', 'forest'],
      tone: 'Short.',
      examplePostIndexes: [1],
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.model).toBe('kimi-k3');
    expect(body.response_format.json_schema.name).toBe('persona');
  });

  it('asks a model without response schemas in words', async () => {
    replies(draft);
    const plain = {
      ...kimi,
      model_spec: {
        ...kimi.model_spec,
        capabilities: { ...kimi.model_spec.capabilities, supportsResponseSchema: false },
      },
    };
    await draftPersonaAsync({ posts: ['a'], instructions: DEFAULT_INSTRUCTIONS.personaDraft, model: plain });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).not.toHaveProperty('response_format');
  });
});
