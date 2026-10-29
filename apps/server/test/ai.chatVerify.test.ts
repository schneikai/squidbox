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

import { VERIFY_JUDGE_MODEL_ID, VERIFY_TURNS, resolveInstructions, type ChatReply } from '@squidbox/shared';
import fixture from './fixtures/venice-models.json';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { cardChecks, changeNote, CHAT_PLAN, check, verifyChatModel } from '../src/ai/chatVerify.js';
import { VerifyStopped } from '../src/ai/verifyTurns.js';

const catalog = fixture.data as CatalogEntry[];
const model = catalog.find((entry) => entry.id === 'kimi-k3')!;
const instructions = {
  ...resolveInstructions(null),
  verifyJudge: [
    'Judge.',
    'About the creator: {aboutYou}',
    'Posts they liked:',
    '{favorites}',
    'Media: {media}',
    "What's in the photos (from image recognition): {tags}",
    "People they've tagged in posts from the same album: {mentions}",
    'Caption so far: {caption}',
    'Before:',
    '{transcript}',
    'Asked: {request}',
    'Reply: {reply}',
  ].join('\n'),
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
  const ok = (expectation: string, text: string, postOptions: string[] = [], before: string[] | null = null) =>
    check(expectation, reply(text, postOptions), before).ok;

  it('reads each kind of expectation', () => {
    expect(ok('talk', 'Nice trip.')).toBe(true);
    expect(ok('talk', 'Here.', ['a'])).toBe(false);
    expect(ok('asks', 'Which dinner?')).toBe(true);
    expect(ok('asks', 'Here is one.')).toBe(false);
    expect(ok('cards:3', '', ['a', 'b', 'c'])).toBe(true);
    expect(ok('cards:3', '', ['a', 'b'])).toBe(false);
    expect(ok('shorter', '', ['ab'], ['abcd'])).toBe(true);
    expect(ok('shorter', '', ['abcd'], ['ab'])).toBe(false);
    expect(ok('shorter', '', ['ab'])).toBe(false);
    expect(ok('lines:3', 'one\ntwo\n\nthree')).toBe(true);
    expect(ok('lines:3', 'one\ntwo')).toBe(false);
    expect(ok('about:moss|bridge', '', ['Moss again', 'The bridge'])).toBe(true);
    expect(ok('about:moss|bridge', '', ['Moss again', 'The beach'])).toBe(false);
    expect(() => check('vibes', reply('x'), null)).toThrow('Unknown expectation vibes');
  });

  it('says in words what a failed one missed, and nothing for a passed one', () => {
    const reason = (expectation: string, text: string, postOptions: string[] = [], before: string[] | null = null) =>
      check(expectation, reply(text, postOptions), before).reason;
    expect(reason('cards:3', 'Here.', ['a'])).toBe('expected 3 posts, got 1');
    expect(reason('cards:3', '', ['a', 'b', 'c'])).toBeNull();
    expect(reason('shorter', '', ['abcd'], ['ab'])).toBe("the posts didn't get shorter");
    expect(reason('talk', 'Here.', ['a'])).toBe('answered with posts instead of talking');
    expect(reason('asks', 'Here is one.')).toBe("didn't ask about the missing detail");
    expect(reason('lines:3', 'one')).toBe('fewer than 3 lines');
    expect(reason('about:moss', '', ['The beach'])).toBe("a post isn't about the caption");
  });
});

describe('cardChecks', () => {
  const post = { photos: 1, videos: 0, tags: [], mentions: ['@ridgeline.bsky.social'], caption: '' };

  it("holds cards to the persona's rules and the post's handles, a failed one with its reason", () => {
    expect(cardChecks([], post, false)).toEqual([]);
    const fine = cardChecks(['Quiet coast with @ridgeline.bsky.social.'], post, false);
    expect(fine.every(({ ok, reason }) => ok && reason === null)).toBe(true);
    const failed = cardChecks(['Wow! #coast with @someone.bsky.social'], post, false).filter(({ ok }) => !ok);
    expect(failed.map(({ reason }) => reason)).toEqual([
      'a hashtag',
      'an exclamation mark',
      'a handle not in the post',
    ]);
  });

  it('checks only the handles without the persona', () => {
    expect(cardChecks(['Wow! #coast'], post, true)).toEqual([
      { name: "handles: only the post's, exact", ok: true, reason: null },
    ]);
  });
});

describe('changeNote', () => {
  it("says the editor's change to the post in words", () => {
    expect(changeNote({ caption: 'Rain.' })).toBe('The editor changed the caption to “Rain.”.');
    expect(changeNote({ caption: 'Moss.', tags: ['moss', 'creek'] })).toBe(
      'The editor changed the caption to “Moss.” and the tags to moss, creek.',
    );
  });
});

describe('verifyChatModel', () => {
  it('runs the scenario turn by turn, judges each turn and counts every check', async () => {
    venice({
      judge: (call) =>
        call === 2 ? { pass: false, reason: 'Ignored the request.' } : { pass: true, reason: ' Answered it. ' },
    });
    const onTurn = vi.fn();
    const result = await verifyChatModel(model, { catalog, instructions, onTurn, sectionIds: ['talk'] });

    const calls = bodies();
    expect(calls).toHaveLength(8);
    expect(calls.map((body) => body.model)).toEqual(
      Array.from({ length: 4 }, () => ['kimi-k3', VERIFY_JUDGE_MODEL_ID]).flat(),
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

  it("misses a turn the model refused, skips the scenario's later turns and goes on", async () => {
    venice({
      model: (last) =>
        last.startsWith('nice, create')
          ? new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'No.' } }] }))
          : modelReply(last),
    });
    const result = await verifyChatModel(model, { catalog, instructions, sectionIds: ['talk', 'facts'] });
    const turns = result.sections[0]!.turns;
    expect(turns).toHaveLength(4);
    expect(turns[1]).toMatchObject({ error: 'The model refused: No.', reply: null, seconds: null });
    expect(turns[1]!.checks).toEqual([
      { name: 'cards:3', ok: false, reason: null },
      { name: 'judge', ok: false, reason: null },
    ]);
    expect(turns[2]!.error).toContain('Skipped');
    expect(turns[3]!.checks.every((each) => !each.ok)).toBe(true);
    // the next scenario runs
    expect(result.sections[1]!.turns[0]!.error).toBeNull();
    // the first turn and its judge, the refused call, then the facts turn and its judge
    expect(bodies()).toHaveLength(5);
  });

  it('stops when Venice stops answering the model, with the turns before', async () => {
    venice({ model: (last) => (last.startsWith('nice, create') ? busy() : modelReply(last)) });
    const run = verifyChatModel(model, { catalog, instructions, sectionIds: ['talk'] });
    await expect(run).rejects.toBeInstanceOf(VerifyStopped);
    const stopped = (await run.catch((error: unknown) => error)) as VerifyStopped;
    expect(stopped.message).toBe('Model is busy');
    expect(stopped.result.sections[0]!.turns).toHaveLength(1);
    // the first turn and its judge, then the call that stopped it: nothing after
    expect(bodies()).toHaveLength(3);
  });

  it('stops when Venice stops answering the judge', async () => {
    venice({ judge: (call) => (call === 1 ? busy() : { pass: true, reason: 'Fine.' }) });
    const stopped = (await verifyChatModel(model, { catalog, instructions, sectionIds: ['talk'] }).catch(
      (error: unknown) => error,
    )) as VerifyStopped;
    expect(stopped).toBeInstanceOf(VerifyStopped);
    expect(stopped.message).toBe('Model is busy');
    expect(stopped.result.sections[0]!.turns).toHaveLength(1);
    expect(bodies()).toHaveLength(4);
  });

  it("fails the judge check with the error when the judge's reply can't be read, and goes on", async () => {
    venice({ judge: (call) => (call === 0 ? 'not json' : { pass: true, reason: 'Fine.' }) });
    const result = await verifyChatModel(model, { catalog, instructions, sectionIds: ['talk'] });
    const turns = result.sections[0]!.turns;
    expect(turns[0]!.checks.at(-1)).toEqual({ name: 'judge', ok: false, reason: "The reply couldn't be read" });
    expect(turns[0]!.error).toBeNull();
    expect(turns).toHaveLength(4);
    expect(turns[3]!.checks.at(-1)).toMatchObject({ ok: true });
  });

  it("records each section's post and the editor's changes as sentences", async () => {
    venice({ model: () => ({ reply: 'Here.', postOptions: POSTS }) });
    const result = await verifyChatModel(model, { catalog, instructions, sectionIds: ['refine'] });
    const [section] = result.sections;
    expect(section!.post).toMatchObject({ photos: 4, videos: 1, caption: '', mentions: ['@ridgeline.bsky.social'] });
    expect(section!.turns.map((turn) => turn.note)).toEqual([
      null,
      'The editor changed the caption to “Three days on the coast. The tent lost to the rain, the car won.”.',
    ]);
  });

  it('shows the system message on the first section and the bare one only', async () => {
    venice({ model: () => ({ reply: 'Okay.', postOptions: [] }) });
    const result = await verifyChatModel(model, { catalog, instructions, sectionIds: ['talk', 'facts', 'bare'] });
    expect(result.sections.map((section) => section.systemMessage !== null)).toEqual([true, false, true]);
    expect(result.sections[2]!.systemMessage).not.toContain('# The creator');
    // the bare section's judge is told the post, not a persona
    const judgeOfBare = bodies()
      .filter((body) => body.model === VERIFY_JUDGE_MODEL_ID)
      .at(-1)!;
    expect(judgeOfBare.messages[0].content).not.toContain('About the creator');
    expect(judgeOfBare.messages[0].content).not.toContain('Posts they liked');
    expect(judgeOfBare.messages[0].content).toContain('@ridgeline.bsky.social');
  });

  it('rejects before any call when Venice does not offer the judge', async () => {
    venice();
    const withoutJudge = catalog.filter((entry) => entry.id !== VERIFY_JUDGE_MODEL_ID);
    await expect(verifyChatModel(model, { catalog: withoutJudge, instructions })).rejects.toThrow(
      'The judge claude-sonnet-5-5: Venice no longer offers this model',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('plans as many turns as the app says, in seven titled sections', () => {
    expect(CHAT_PLAN.sections.flatMap((section) => section.prompts)).toHaveLength(VERIFY_TURNS.writing);
    expect(CHAT_PLAN.sections.map((section) => section.title)).toEqual([
      'Talk first, then posts',
      'Changes on request',
      'Captions, bios and back',
      'An opinion and a question',
      'The caption button',
      'Sticks to the facts',
      'Without Writing as you',
    ]);
  });
});
