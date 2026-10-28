// The chat check of a writing model (Settings → Assistant → Writing → ⋯ → Run check for an ai_admin,
// or `npm run check:models`): fixed scenarios run turn by turn through the server's own chat code
// (chatMessages with the briefing, the chat task with its reply schema, the unreadable-reply fallback
// and checkChatReply), briefed as the mock account's creator (mockPersona.ts) with his Favorites, each
// real reply appended to the transcript as the app keeps it. Each turn gets the checks that can be
// made in code, then one judge question to JUDGE_MODEL_ID: did the reply answer the request and hold
// the conversation.
import {
  CHECK_JUDGE_MODEL_ID,
  type ChatContext,
  type ChatReply,
  type ChatTurn,
  type ModelCheckSection,
} from '@squidbox/shared';
import { findModel } from './catalog.js';
import { checkProgress, failedTurn, timedCall } from './checkTurns.js';
import { MOCK_FAVORITES, MOCK_PERSONA } from './mockPersona.js';
import type { CheckRunner } from './modelCheck.js';
import { chatMessages, judgeMessages } from './prompts.js';
import { chatTask, judgeTask, runTask } from './tasks.js';

// The judge of every turn, the same for every model checked.
export const JUDGE_MODEL_ID = CHECK_JUDGE_MODEL_ID;

type Post = { photos: number; videos: number; tags: string[]; mentions: string[]; caption: string };

/**
 * A user message, after an optional change to the post (`post`, as the editor would make it). With
 * `caption`, the message is the editor's caption button: its prompt, a blank line and the caption,
 * as promptTurn builds it. `expect` names what the reply should be:
 *   talk      a reply and no cards
 *   asks      no cards, and the reply asks something back (a detail it wasn't given)
 *   cards:N   N cards
 *   shorter   cards, on average shorter than the previous set
 *   lines:N   no cards, and at least N lines in the reply (bios, ideas)
 *   about:re  every card matches the regex (the caption was rewritten, not the chat's posts)
 * Every reply with cards is also checked against the persona's rules, the Favorites (never copied)
 * and the post's handles (only those, spelled exactly).
 */
type Step = { user: string; post?: Partial<Post>; caption?: true; expect: string[] };

const BASE_POST: Post = {
  photos: 4,
  videos: 1,
  tags: [
    'coastline',
    'grey sky',
    'wet sand',
    'tent',
    'rain drops',
    'pine forest',
    'dirt road',
    'golden hour',
    'parked car',
    'coffee mug',
    'driftwood',
    'empty beach',
  ],
  mentions: ['@ridgeline.bsky.social'],
  caption: '',
};

const TRIP_POSTS =
  'Write 3 posts about the coast trip: rain the first day, then an empty beach, the tent flooded and I slept in the car.';
const BRIDGE = 'Moss on the old stone bridge after a week of rain.';

export const SCENARIOS: Record<string, { title: string; steps: Step[] }> = {
  talk: {
    title: 'Talk first, posts when asked, refine, then a bio',
    steps: [
      {
        user: 'Just got back from three days on the coast. Rained the whole first day, then it cleared and we had the entire beach to ourselves. Slept in the car one night because the tent flooded.',
        expect: ['talk'],
      },
      { user: 'nice, create some posts with this idea', expect: ['cards:3'] },
      { user: 'make them shorter', expect: ['cards:3', 'shorter'] },
      { user: 'give me 3 bio ideas', expect: ['lines:3'] },
    ],
  },
  refine: {
    title: '"Each post" after the caption changed',
    steps: [
      { user: TRIP_POSTS, expect: ['cards:3'] },
      {
        post: { caption: 'Three days on the coast. The tent lost to the rain, the car won.' },
        user: 'Make each post drier and a little funnier. Same idea, one wry twist.',
        expect: ['cards:3'],
      },
    ],
  },
  switch: {
    title: 'Captions, a switch to bios, back with a count and the handle',
    steps: [
      {
        user: 'Write 3 captions for these photos. Short, for Bluesky, one line each. Name the place only by its region.',
        expect: ['cards:3'],
      },
      { user: 'Give me 3 bio ideas for my Bluesky profile', expect: ['lines:3'] },
      { user: 'ok back to the captions, give me 5 more, mention who was there', expect: ['cards:5'] },
    ],
  },
  opinion: {
    title: 'An opinion is talk, counts are kept, a question about the caption',
    steps: [
      { user: TRIP_POSTS, expect: ['cards:3'] },
      { user: 'hm, is the second one too negative? people follow me for the calm stuff', expect: ['talk'] },
      { user: 'ok, 4 more in the spirit of the first one', expect: ['cards:4'] },
      {
        post: { caption: 'Rain, then nobody for miles. The tent quit, the car stepped up.' },
        user: 'is the caption too long for bluesky?',
        expect: ['talk'],
      },
    ],
  },
  caption: {
    title: 'The caption button after a chat about other posts ("this" means the caption)',
    steps: [
      { user: TRIP_POSTS, expect: ['cards:3'] },
      {
        post: { caption: BRIDGE, tags: ['moss', 'stone bridge', 'rain', 'wet stone', 'forest', 'creek'] },
        caption: true,
        user: 'Make this drier and a little funnier. Same idea, one wry twist.',
        expect: ['cards:3', 'about:moss|bridge|stone'],
      },
      { user: 'Make each post shorter. Keep the first line, cut the rest.', expect: ['cards:3', 'shorter'] },
    ],
  },
  facts: {
    title: 'A detail it was never given: it asks instead of inventing',
    steps: [{ user: 'Write a post about the dinner we cooked on the last night.', expect: ['asks'] }],
  },
};

// The talk scenario without Writing as you or Favorites: the briefing with those sections dropped.
export const BARE = 'bare';

// Every section, in the order a whole run has them.
export const CHAT_SECTION_IDS = [...Object.keys(SCENARIOS), BARE];

const FAVORITE_TEXTS = MOCK_FAVORITES.map((favorite) => favorite.text);
const HANDLE = /@[\w-]+(?:\.[\w-]+)+/g;

const normalized = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const meanLength = (texts: string[]) => texts.reduce((sum, text) => sum + text.length, 0) / (texts.length || 1);

// One expectation on a reply, given the previous set of cards.
export function check(expectation: string, reply: ChatReply, before: string[] | null): boolean {
  const [kind, arg] = expectation.split(/:(.*)/s);
  const cards = reply.postOptions;
  if (kind === 'talk') return reply.reply.length > 0 && cards.length === 0;
  if (kind === 'asks') return cards.length === 0 && reply.reply.includes('?');
  if (kind === 'cards') return cards.length === Number(arg);
  if (kind === 'shorter') return !!before && cards.length > 0 && meanLength(cards) < meanLength(before);
  if (kind === 'lines') {
    return cards.length === 0 && reply.reply.split('\n').filter((line) => line.trim()).length >= Number(arg);
  }
  if (kind === 'about') return cards.length > 0 && cards.every((card) => new RegExp(arg!, 'i').test(card));
  throw new Error(`Unknown expectation ${expectation}`);
}

// The checks every set of cards gets: the persona's rules, no copied Favorite, only the post's handles.
export function cardChecks(cards: string[], post: Post, isBare: boolean): [string, boolean][] {
  if (cards.length === 0) return [];
  const checks: [string, boolean][] = [];
  if (!isBare) {
    checks.push(['rules: no hashtags', cards.every((card) => !/(^|\s)#\w/.test(card))]);
    checks.push(['rules: no exclamation marks', cards.every((card) => !card.includes('!'))]);
    checks.push(['rules: under 300 characters', cards.every((card) => card.length < 300)]);
    checks.push([
      'favorites: none copied',
      cards.every((card) => !FAVORITE_TEXTS.some((text) => normalized(card).includes(normalized(text)))),
    ]);
  }
  const handles = cards.flatMap((card) => card.match(HANDLE) ?? []);
  checks.push(["handles: only the post's, exact", handles.every((handle) => post.mentions.includes(handle))]);
  return checks;
}

function contextOf(post: Post): ChatContext {
  return {
    kind: 'draft',
    text: post.caption,
    media: { photo: post.photos, video: post.videos },
    tags: post.tags,
    mentions: post.mentions,
  };
}

/**
 * Runs the chat check's sections (`sectionIds`, all by default) on `model`, briefed with
 * `instructions.writing` and judged with `instructions.modelCheckJudge`. A thrown model call is its
 * turn's error, and the scenario's later turns are skipped as failed (they build on its reply); a
 * thrown judge call is a failed judge check with the error as its reason. Rejects before any call
 * when Venice doesn't offer the judge.
 */
export const checkChatModel: CheckRunner = async (model, { catalog, instructions, onTurn, sectionIds }) => {
  const judgeFound = findModel(catalog, JUDGE_MODEL_ID, 'writing');
  if ('error' in judgeFound) throw new Error(`The judge ${JUDGE_MODEL_ID}: ${judgeFound.error}`);
  const judge = judgeFound.entry;
  const progress = checkProgress(onTurn);
  let isFirstSection = true;
  for (const id of sectionIds ?? CHAT_SECTION_IDS) {
    const isBare = id === BARE;
    const scenario = SCENARIOS[isBare ? 'talk' : id]!;
    const title = isBare ? `${scenario.title}, without Writing as you or Favorites` : scenario.title;
    let section: ModelCheckSection | null = null;
    let post = { ...BASE_POST };
    const transcript: ChatTurn[] = [];
    let before: string[] | null = null;
    let failure: string | null = null;
    for (const step of scenario.steps) {
      if (step.post) post = { ...post, ...step.post };
      const note = step.post ? JSON.stringify(step.post) : null;
      const content = step.caption ? `${step.user}\n\n${post.caption}` : step.user;
      const messages = chatMessages({
        context: contextOf(post),
        transcript: [...transcript, { role: 'user', content }],
        persona: isBare ? null : MOCK_PERSONA,
        favorites: isBare ? [] : FAVORITE_TEXTS,
        instructions,
      });
      if (!section) {
        // The briefing shows once, and again for the bare one, which differs.
        const systemMessage = isFirstSection || isBare ? String(messages[0]!.content) : null;
        section = progress.section(id, title, systemMessage);
        isFirstSection = false;
      }
      const expected = [...step.expect, 'judge'];
      if (failure) {
        await progress.add(section, failedTurn({ prompt: content, note }, `Skipped: ${failure}`, expected));
        continue;
      }
      let unreadable = false;
      const task = {
        ...chatTask,
        onUnreadable: (text: string, json: unknown) => {
          unreadable = true;
          return chatTask.onUnreadable!(text, json);
        },
      };
      const call = await timedCall(() => runTask({ task, messages, model }));
      if ('error' in call) {
        failure = `an earlier turn failed (${call.error})`;
        await progress.add(section, failedTurn({ prompt: content, note }, call.error, expected));
        continue;
      }
      const reply: ChatReply = call.value;
      const verdict = await timedCall(() =>
        runTask({
          task: judgeTask,
          messages: judgeMessages({
            template: instructions.modelCheckJudge,
            context: contextOf(post),
            persona: isBare ? null : MOCK_PERSONA,
            favorites: isBare ? [] : FAVORITE_TEXTS,
            transcript,
            request: content,
            reply,
          }),
          model: judge,
        }),
      );
      const checks = [
        ...step.expect.map((name) => ({ name, ok: check(name, reply, before), reason: null })),
        ...cardChecks(reply.postOptions, post, isBare).map(([name, ok]) => ({ name, ok, reason: null })),
        'error' in verdict
          ? { name: 'judge', ok: false, reason: verdict.error }
          : { name: 'judge', ok: verdict.value.pass, reason: verdict.value.reason || null },
      ];
      await progress.add(section, {
        prompt: content,
        note,
        seconds: call.seconds,
        unreadable,
        reply: reply.reply,
        items: reply.postOptions,
        checks,
        error: null,
      });
      transcript.push({ role: 'user', content }, { role: 'assistant', ...reply });
      if (reply.postOptions.length > 0) before = reply.postOptions;
    }
  }
  return progress.result();
};
