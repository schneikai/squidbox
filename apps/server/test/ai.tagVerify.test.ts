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

import { resolveInstructions } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { PHOTO_FILES, TAG_PLAN, verifyTaggingModel } from '../src/ai/tagVerify.js';
import { VerifyStopped } from '../src/ai/verifyTurns.js';

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
const run = () => verifyTaggingModel(model, { catalog, instructions });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('verifyTaggingModel', () => {
  it("sends each photo with the Photo tags briefing filled with the mock creator's themes", async () => {
    venice([{ tags: EIGHT }]);
    await run();
    const sent = bodies();
    expect(sent).toHaveLength(4);
    expect(sent[0].messages[0].content).toContain("Creator's content themes: landscape, hiking, forest");
    sent.forEach((body, index) => {
      const file = readFileSync(new URL(`../src/ai/verifyPhotos/${PHOTO_FILES[index]}`, import.meta.url));
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
    expect(section).toMatchObject({ id: 'photos', title: 'Photo tags', systemMessage: null, post: null });
    expect(section!.turns.map((turn) => turn.prompt)).toEqual(PHOTO_FILES);
    expect(section!.turns[0]).toMatchObject({ reply: null, items: EIGHT, error: null });
    expect(section!.turns[0]!.checks).toEqual([{ name: 'within the limits', ok: true, reason: null }]);
    expect(result).toMatchObject({ passes: 4, fails: 0 });
  });

  it('fails too many tags, a tag too long and a duplicate', async () => {
    const many = Array.from({ length: 21 }, (_, index) => `tag ${index}`);
    venice([{ tags: many }, { tags: [...EIGHT, 'x'.repeat(50)] }, { tags: [...EIGHT, 'Coast'] }, { tags: EIGHT }]);
    const result = await run();
    expect(result.sections[0]!.turns.map((turn) => turn.checks[0]!.reason)).toEqual([
      '21 tags, over the limit of 20',
      'a tag over 40 characters or a duplicate',
      'a tag over 40 characters or a duplicate',
      null,
    ]);
    expect(result).toMatchObject({ passes: 1, fails: 3 });
  });

  it("makes a reply that isn't the JSON that photo's miss, and tags the next one", async () => {
    venice(['I cannot help with that.', { tags: EIGHT }]);
    const result = await run();
    const [refused, next] = result.sections[0]!.turns;
    expect(refused!.error).toEqual(expect.any(String));
    expect(refused!.checks).toEqual([{ name: 'within the limits', ok: false, reason: null }]);
    expect(next).toMatchObject({ error: null, items: EIGHT });
    expect(bodies()).toHaveLength(4);
  });

  it("makes a refusal that photo's miss, and tags the next one", async () => {
    const refusal = new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'No.' } }] }));
    venice([refusal, { tags: EIGHT }, { tags: EIGHT }, { tags: EIGHT }]);
    const result = await run();
    expect(result.sections[0]!.turns.map((turn) => turn.error)).toEqual(['The model refused: No.', null, null, null]);
  });

  it('stops when Venice stops answering, with the photos before', async () => {
    const busy = new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: 503 });
    venice([{ tags: EIGHT }, busy]);
    const stopped = (await run().catch((error: unknown) => error)) as VerifyStopped;
    expect(stopped).toBeInstanceOf(VerifyStopped);
    expect(stopped.message).toBe('Model is busy');
    expect(stopped.result.sections[0]!.turns).toHaveLength(1);
    expect(bodies()).toHaveLength(2);
  });

  it('plans one turn for each of the four photos', () => {
    expect(TAG_PLAN.sections.flatMap((section) => section.prompts)).toEqual(PHOTO_FILES);
    expect(PHOTO_FILES).toHaveLength(4);
  });
});
