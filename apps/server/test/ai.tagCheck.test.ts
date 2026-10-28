import { readFileSync } from 'node:fs';
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

import { CHECK_TURNS, resolveInstructions } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { checkTaggingModel, PHOTO_FILES } from '../src/ai/tagCheck.js';

const catalog = fixture.data as CatalogEntry[];
const model = catalog.find((entry) => entry.id === 'gemma-4-uncensored')!;
const instructions = resolveInstructions(null);
const fetchMock = vi.fn();

const EIGHT = ['coast', 'fog', 'pine', 'trail', 'moss', 'creek', 'calm', 'film look'];

// The model's reply for each photo in turn: a tags object, or a Response for an error.
function venice(replies: unknown[]) {
  let call = 0;
  fetchMock.mockImplementation(async () => {
    const reply = replies[call++ % replies.length];
    if (reply instanceof Response) return reply;
    const content = typeof reply === 'string' ? reply : JSON.stringify(reply);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }));
  });
}

const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
const run = () => checkTaggingModel(model, { catalog, instructions });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('checkTaggingModel', () => {
  it("sends each photo with the Photo tags briefing filled with the mock creator's themes", async () => {
    venice([{ tags: EIGHT }]);
    await run();
    const sent = bodies();
    expect(sent).toHaveLength(4);
    expect(sent[0].messages[0].content).toContain("Creator's content themes: landscape, hiking, forest");
    sent.forEach((body, index) => {
      const file = readFileSync(new URL(`../src/ai/checkPhotos/${PHOTO_FILES[index]}`, import.meta.url));
      expect(body.model).toBe('gemma-4-uncensored');
      expect(body.messages[1].content).toEqual([
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file.toString('base64')}` } },
      ]);
    });
  });

  it('passes eight short tags on every photo', async () => {
    venice([{ tags: EIGHT }]);
    const result = await run();
    const [section] = result.sections;
    expect(section).toMatchObject({ id: 'photos', title: 'Photo tags', systemMessage: null });
    expect(section!.turns.map((turn) => turn.prompt)).toEqual(PHOTO_FILES);
    expect(section!.turns[0]).toMatchObject({ reply: null, items: EIGHT, error: null });
    expect(section!.turns[0]!.checks).toEqual([{ name: 'within the limits', ok: true, reason: null }]);
    expect(result).toMatchObject({ passes: 4, fails: 0 });
  });

  it('fails too many tags, a tag too long and a duplicate', async () => {
    const many = Array.from({ length: 21 }, (_, index) => `tag ${index}`);
    venice([{ tags: many }, { tags: [...EIGHT, 'x'.repeat(50)] }, { tags: [...EIGHT, 'Coast'] }, { tags: EIGHT }]);
    const result = await run();
    expect(result.sections[0]!.turns.map((turn) => turn.checks[0]!.ok)).toEqual([false, false, false, true]);
    expect(result).toMatchObject({ passes: 1, fails: 3 });
  });

  it("makes a refusal that photo's error, and tags the next one", async () => {
    venice(['I cannot help with that.', { tags: EIGHT }]);
    const result = await run();
    const [refused, next] = result.sections[0]!.turns;
    expect(refused!.error).toEqual(expect.any(String));
    expect(refused!.checks).toEqual([{ name: 'within the limits', ok: false, reason: null }]);
    expect(next).toMatchObject({ error: null, items: EIGHT });
    expect(bodies()).toHaveLength(4);
  });

  it('has as many turns as the app says', () => {
    expect(PHOTO_FILES).toHaveLength(CHECK_TURNS.vision);
  });
});
