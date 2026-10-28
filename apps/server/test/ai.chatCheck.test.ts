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

import { CHECK_TURNS, resolveInstructions, type ChatReply } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import type { CatalogEntry } from '../src/ai/catalog.js';
import {
  BARE,
  cardChecks,
  CHAT_SECTION_IDS,
  check,
  checkChatModel,
  JUDGE_MODEL_ID,
  SCENARIOS,
} from '../src/ai/chatCheck.js';
import { CHECKS } from '../src/ai/modelCheck.js';

const catalog = fixture.data as CatalogEntry[];
const model = catalog.find((entry) => entry.id === 'kimi-k3')!;
const instructions = {
  ...resolveInstructions(null),
  modelCheckJudge: 'Judge.\nTold:\n{context}\nBefore:\n{transcript}\nAsked: {request}\nReply: {reply}',
};
const fetchMock = vi.fn();

const POSTS = [
  'Rain first, then the whole beach to ourselves.',
  'The tent flooded. The car held.',
  'Three days, one dry night.',
];
const SHORTER = ['Rain, then beach.', 'Tent lost. Car won.', 'One dry night.'];

// The talk scenario's model replies, by the creator's last message, and the judge's verdicts.
function modelReply(last: string): ChatReply {
  if (last.startsWith('Just got back')) return { reply: 'Sounds like a trip. Want posts?', postOptions: [] };
  if (last.startsWith('nice, create')) return { reply: 'Here you go.', postOptions: POSTS };
  if (last.startsWith('make them shorter')) return { reply: 'Shorter.', postOptions: SHORTER };
  return { reply: 'Coast, rain, car.\nQuiet roads.\nSlow mornings.', postOptions: [] };
}

type Answer = { model?: (last: string) => unknown; judge?: (call: number) => unknown };

function venice({
  model: answerModel = modelReply,
  judge = () => ({ pass: true, reason: ' Answered it. ' }),
}: Answer = {}) {
  let judgeCalls = 0;
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const name = body.response_format.json_schema.name;
    let content: unknown;
    if (name === 'judge_verdict') content = judge(judgeCalls++);
    else content = answerModel(body.messages[body.messages.length - 1].content);
    if (content instanceof Response) return content;
    return new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }),
    );
  });
}

const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
const busy = () => new Response(JSON.stringify({ error: { message: 'Model is busy' } }), { status: 503 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('check', () => {
  const reply = (text: string, postOptions: string[] = []) => ({ reply: text, postOptions });

  it('reads each kind of expectation', () => {
    expect(check('talk', reply('Nice trip.'), null)).toBe(true);
    expect(check('talk', reply('Here.', ['a']), null)).toBe(false);
    expect(check('asks', reply('Which dinner?'), null)).toBe(true);
    expect(check('asks', reply('Here is one.'), null)).toBe(false);
    expect(check('cards:3', reply('', ['a', 'b', 'c']), null)).toBe(true);
    expect(check('cards:3', reply('', ['a', 'b']), null)).toBe(false);
    expect(check('shorter', reply('', ['ab']), ['abcd'])).toBe(true);
    expect(check('shorter', reply('', ['abcd']), ['ab'])).toBe(false);
    expect(check('shorter', reply('', ['ab']), null)).toBe(false);
    expect(check('lines:3', reply('one\ntwo\n\nthree'), null)).toBe(true);
    expect(check('lines:3', reply('one\ntwo'), null)).toBe(false);
    expect(check('about:moss|bridge', reply('', ['Moss again', 'The bridge']), null)).toBe(true);
    expect(check('about:moss|bridge', reply('', ['Moss again', 'The beach']), null)).toBe(false);
    expect(() => check('vibes', reply('x'), null)).toThrow('Unknown expectation vibes');
  });
});

describe('cardChecks', () => {
  const post = { photos: 1, videos: 0, tags: [], mentions: ['@ridgeline.bsky.social'], caption: '' };

  it("holds cards to the persona's rules and the post's handles", () => {
    expect(cardChecks([], post, false)).toEqual([]);
    const fine = cardChecks(['Quiet coast with @ridgeline.bsky.social.'], post, false);
    expect(fine.every(([, ok]) => ok)).toBe(true);
    const failed = Object.fromEntries(cardChecks(['Wow! #coast with @someone.bsky.social'], post, false));
    expect(failed).toMatchObject({
      'rules: no hashtags': false,
      'rules: no exclamation marks': false,
      "handles: only the post's, exact": false,
    });
  });

  it('checks only the handles without the persona', () => {
    expect(cardChecks(['Wow! #coast'], post, true).map(([name]) => name)).toEqual(["handles: only the post's, exact"]);
  });
});

describe('checkChatModel', () => {
  it('runs the scenario turn by turn, judges each turn and counts every check', async () => {
    venice({
      judge: (call) =>
        call === 2 ? { pass: false, reason: 'Ignored the request.' } : { pass: true, reason: ' Answered it. ' },
    });
    const onTurn = vi.fn();
    const result = await checkChatModel(model, { catalog, instructions, onTurn, sectionIds: ['talk'] });

    const calls = bodies();
    expect(calls).toHaveLength(8);
    expect(calls.map((body) => body.model)).toEqual(
      Array.from({ length: 4 }, () => ['kimi-k3', JUDGE_MODEL_ID]).flat(),
    );
    const judge = calls[3]!;
    expect(judge.messages).toHaveLength(1);
    expect(judge.messages[0].role).toBe('user');
    expect(judge.messages[0].content).toContain('Asked: nice, create some posts with this idea');
    expect(judge.messages[0].content).toContain(
      'Reply: Here you go.\n1. Rain first, then the whole beach to ourselves.',
    );
    expect(judge.messages[0].content).toContain('Creator: Just got back');
    expect(judge.messages[0].content).toContain('Assistant: Sounds like a trip. Want posts?');
    expect(calls[1]!.messages[0].content).toContain('Before:\n(none)');
    // what the writing model was told about the creator and the post
    expect(judge.messages[0].content).toContain("About the creator: I'm a guy who shoots outdoors");
    expect(judge.messages[0].content).toContain(
      "People they've tagged in posts from the same album: @ridgeline.bsky.social",
    );
    expect(judge.messages[0].content).toContain("What's in the photos (from image recognition): coastline, grey sky");
    expect(judge.messages[0].content).toContain('Media: 4 photos and 1 video');
    expect(judge.messages[0].content).toContain('Caption so far: (empty)');
    expect(judge.messages[0].content).toContain('Posts they liked:\n- ');

    expect(onTurn.mock.calls.map(([, turnsDone]) => turnsDone)).toEqual([1, 2, 3, 4]);
    const [section] = result.sections;
    expect(section).toMatchObject({ id: 'talk', title: expect.stringContaining('Talk first') });
    expect(section!.systemMessage).toContain('You are the writing assistant inside Squidbox');
    expect(section!.turns).toHaveLength(4);
    const third = section!.turns[2]!;
    expect(third.items).toEqual(SHORTER);
    expect(third.checks.at(-1)).toEqual({ name: 'judge', ok: false, reason: 'Ignored the request.' });
    expect(section!.turns[0]!.checks.at(-1)).toEqual({ name: 'judge', ok: true, reason: 'Answered it.' });
    expect(section!.turns[0]!.seconds).toEqual(expect.any(Number));
    const checks = section!.turns.flatMap((turn) => turn.checks);
    expect(result.passes).toBe(checks.filter((each) => each.ok).length);
    expect(result.fails).toBe(1);
    expect(result.unreadable).toBe(0);
  });

  it('ends a scenario at a thrown model call and counts the rest as failed', async () => {
    venice({ model: (last) => (last.startsWith('nice, create') ? busy() : modelReply(last)) });
    const result = await checkChatModel(model, { catalog, instructions, sectionIds: ['talk'] });
    const turns = result.sections[0]!.turns;
    expect(turns).toHaveLength(4);
    expect(turns[1]).toMatchObject({ error: 'Model is busy', reply: null, seconds: null });
    expect(turns[1]!.checks).toEqual([
      { name: 'cards:3', ok: false, reason: null },
      { name: 'judge', ok: false, reason: null },
    ]);
    expect(turns[2]!.error).toContain('Skipped');
    expect(turns[3]!.checks.every((each) => !each.ok)).toBe(true);
    // the first turn and its judge, then the failed call: nothing after
    expect(bodies()).toHaveLength(3);
    expect(result.fails).toBe(2 + 3 + 2);
  });

  it('fails the judge check with the error when the judge call throws, and goes on', async () => {
    venice({ judge: (call) => (call === 0 ? busy() : { pass: true, reason: 'Fine.' }) });
    const result = await checkChatModel(model, { catalog, instructions, sectionIds: ['talk'] });
    const turns = result.sections[0]!.turns;
    expect(turns[0]!.checks.at(-1)).toEqual({ name: 'judge', ok: false, reason: 'Model is busy' });
    expect(turns[0]!.error).toBeNull();
    expect(turns).toHaveLength(4);
    expect(turns[3]!.checks.at(-1)).toMatchObject({ ok: true });
  });

  it('shows the system message on the first section and the bare one only', async () => {
    venice({ model: () => ({ reply: 'Okay.', postOptions: [] }) });
    const result = await checkChatModel(model, { catalog, instructions, sectionIds: ['talk', 'facts', 'bare'] });
    expect(result.sections.map((section) => section.systemMessage !== null)).toEqual([true, false, true]);
    expect(result.sections[2]!.systemMessage).not.toContain('# The creator');
    // the bare section's judge is told the post, not a persona
    const judgeOfBare = bodies()
      .filter((body) => body.model === JUDGE_MODEL_ID)
      .at(-1)!;
    expect(judgeOfBare.messages[0].content).not.toContain('About the creator');
    expect(judgeOfBare.messages[0].content).not.toContain('Posts they liked');
    expect(judgeOfBare.messages[0].content).toContain('@ridgeline.bsky.social');
  });

  it('rejects before any call when Venice does not offer the judge', async () => {
    venice();
    const withoutJudge = catalog.filter((entry) => entry.id !== JUDGE_MODEL_ID);
    await expect(checkChatModel(model, { catalog: withoutJudge, instructions })).rejects.toThrow(
      'The judge claude-sonnet-5-5: Venice no longer offers this model',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has as many turns as the app says', () => {
    expect(CHECKS.writing.turnCount).toBe(CHECK_TURNS.writing);
    const steps = CHAT_SECTION_IDS.map((id) => SCENARIOS[id === BARE ? 'talk' : id]!.steps.length);
    expect(steps.reduce((sum, count) => sum + count, 0)).toBe(CHECK_TURNS.writing);
  });
});
