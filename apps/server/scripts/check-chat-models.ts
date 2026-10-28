/**
 * Evaluates Venice models as the assistant chat's writing model, on demand: each scenario runs turn
 * by turn through the server's own chat code (chatMessages with the default briefing, the chat task
 * with its reply schema, the unreadable-reply fallback and checkChatReply), briefed with the mock
 * account's creator (mockPersona.ts) and his Favorites, each real reply appended to the transcript as
 * the app keeps it. Checks what can be checked automatically and writes every transcript to a
 * Markdown report, with per-model pass counts and seconds per turn, for a human to read the replies.
 *
 * Run from apps/server:
 *   npm run check:chat-models -- deepseek-v4-1-flash-uncensored kimi-k3
 *   npm run check:chat-models -- qwen-3-6-plus --scenario 4 --out /tmp/qwen.md
 *
 * Calls Venice directly with VENICE_API_KEY (apps/server/.env or the shell), and refuses any other
 * VENICE_BASE_URL. No database, no backend. The report goes to .model-checks/ (gitignored) unless
 * --out names a file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_INSTRUCTIONS, type ChatContext, type ChatReply, type ChatTurn } from '@squidbox/shared';
import { catalogAsync, findModel, type CatalogEntry } from '../src/ai/catalog.js';
import { chatMessages } from '../src/ai/prompts.js';
import { chatTask, runTask } from '../src/ai/tasks.js';
import { MOCK_FAVORITES, MOCK_PERSONA } from './mockPersona.js';

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

const SCENARIOS: Record<string, { title: string; steps: Step[] }> = {
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

// The same scenario without Writing as you or Favorites: the briefing with those sections dropped.
const BARE = 'bare';

const FAVORITE_TEXTS = MOCK_FAVORITES.map((favorite) => favorite.text);
const HANDLE = /@[\w-]+(?:\.[\w-]+)+/g;

const normalized = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const meanLength = (texts: string[]) => texts.reduce((sum, text) => sum + text.length, 0) / (texts.length || 1);

// One expectation on a reply, given the previous set of cards.
function check(expectation: string, reply: ChatReply, before: string[] | null): boolean {
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
function cardChecks(cards: string[], post: Post, isBare: boolean): [string, boolean][] {
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

type ModelResult = {
  id: string;
  passes: number;
  fails: number;
  unreadable: number;
  seconds: number[];
  lines: string[];
};

async function checkModel(model: CatalogEntry, scenarioIds: string[]): Promise<ModelResult> {
  const result: ModelResult = { id: model.id, passes: 0, fails: 0, unreadable: 0, seconds: [], lines: [] };
  const say = (line = '') => result.lines.push(line);
  let shownBriefing = false;
  for (const id of scenarioIds) {
    const isBare = id === BARE;
    const scenario = SCENARIOS[isBare ? 'talk' : id]!;
    say(`### ${id}: ${isBare ? `${scenario.title}, without Writing as you or Favorites` : scenario.title}`);
    let post = { ...BASE_POST };
    const transcript: ChatTurn[] = [];
    let before: string[] | null = null;
    for (const step of scenario.steps) {
      if (step.post) {
        post = { ...post, ...step.post };
        say(`*The editor changed the post: ${JSON.stringify(step.post)}*`);
        say();
      }
      const content = step.caption ? `${step.user}\n\n${post.caption}` : step.user;
      transcript.push({ role: 'user', content });
      const messages = chatMessages({
        context: contextOf(post),
        transcript,
        persona: isBare ? null : MOCK_PERSONA,
        favorites: isBare ? [] : FAVORITE_TEXTS,
        instructions: DEFAULT_INSTRUCTIONS,
      });
      if (!shownBriefing || (isBare && transcript.length === 1)) {
        say(`<details><summary>System message${isBare ? ' (no persona, no Favorites)' : ''}</summary>`);
        say();
        say('```');
        say(String(messages[0]!.content));
        say('```');
        say('</details>');
        say();
        shownBriefing = true;
      }
      say(content.replace(/^/gm, '> '));
      say();
      let unreadable = false;
      const task = {
        ...chatTask,
        onUnreadable: (text: string, json: unknown) => {
          unreadable = true;
          return chatTask.onUnreadable!(text, json);
        },
      };
      const started = Date.now();
      let reply: ChatReply;
      try {
        reply = await runTask({ task, messages, model });
      } catch (error) {
        say(`**Error:** ${(error as Error).message}`);
        say();
        result.fails += step.expect.length;
        break;
      }
      const seconds = (Date.now() - started) / 1000;
      result.seconds.push(seconds);
      if (unreadable) result.unreadable++;
      say(`*${seconds.toFixed(1)} s${unreadable ? ', not the JSON: kept as text' : ''}*`);
      say();
      say(reply.reply ? reply.reply.replace(/^/gm, '    ') : '    (no reply text)');
      say();
      reply.postOptions.forEach((option, index) => say(`${index + 1}. ${option.replace(/\n/g, ' / ')}`));
      if (reply.postOptions.length > 0) say();
      const outcomes: [string, boolean][] = [
        ...step.expect.map((expectation): [string, boolean] => [expectation, check(expectation, reply, before)]),
        ...cardChecks(reply.postOptions, post, isBare),
      ];
      for (const [, ok] of outcomes) {
        if (ok) result.passes++;
        else result.fails++;
      }
      say(outcomes.map(([name, ok]) => `${ok ? 'PASS' : '**FAIL**'} ${name}`).join(' · '));
      say();
      transcript.push({ role: 'assistant', ...reply });
      if (reply.postOptions.length > 0) before = reply.postOptions;
    }
  }
  return result;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function parseArgs(args: string[]): { models: string[]; scenarios: string[]; out: string | null } {
  const models: string[] = [];
  const scenarios: string[] = [];
  let out: string | null = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--scenario') scenarios.push(args[++index]!);
    else if (arg === '--out') out = args[++index]!;
    else models.push(arg);
  }
  const known = [...Object.keys(SCENARIOS), BARE];
  for (const id of scenarios) if (!known.includes(id)) throw new Error(`No scenario ${id} (${known.join(', ')})`);
  return { models, scenarios: scenarios.length > 0 ? scenarios : known, out };
}

async function main() {
  const { models, scenarios, out } = parseArgs(process.argv.slice(2));
  if (models.length === 0) {
    throw new Error('Usage: npm run check:chat-models -- <modelId>… [--scenario <id>]… [--out <file.md>]');
  }
  if (!process.env.VENICE_API_KEY) throw new Error('VENICE_API_KEY is not set (apps/server/.env or the shell)');
  const base = process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1';
  if (!base.startsWith('https://api.venice.ai/')) throw new Error(`Not Venice: ${base}`);

  const { entries } = await catalogAsync();
  const results: ModelResult[] = [];
  for (const id of models) {
    const found = findModel(entries, id, 'writing');
    if ('error' in found) {
      console.error(`${id}: ${found.error}`);
      continue;
    }
    console.log(`${id}…`);
    const result = await checkModel(found.entry, scenarios);
    console.log(`${id}: ${result.passes} passed, ${result.fails} failed, ${result.unreadable} not JSON`);
    results.push(result);
  }

  const startedAt = new Date().toISOString();
  const report = [
    `# Chat model check, ${startedAt}`,
    '',
    `Scenarios: ${scenarios.join(', ')}. The default briefing, the mock creator, the server's chat task.`,
    '',
    '| Model | Passed | Failed | Not JSON | Median s/turn | Slowest turn |',
    '|---|---|---|---|---|---|',
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.passes} | ${result.fails} | ${result.unreadable} | ${median(result.seconds).toFixed(1)} | ${Math.max(0, ...result.seconds).toFixed(1)} |`,
    ),
    '',
    ...results.flatMap((result) => [`## ${result.id}`, '', ...result.lines]),
  ].join('\n');
  const file =
    out ??
    join(
      dirname(new URL(import.meta.url).pathname),
      '..',
      '.model-checks',
      `chat-${startedAt.replace(/[:.]/g, '-')}.md`,
    );
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${report}\n`);
  console.log(`Report: ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
