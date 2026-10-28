import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const INSTRUCTION_LIMITS = { text: 4000 } as const;

// `instructions` — what the assistant is told (Settings → Assistant → Instructions), one text per
// kind, each the user's to edit. One record per user, whose id is the user's id, like `personas`, so
// two devices editing different kinds converge. Null is "the app's default", so a reset is a
// per-field write like any edit.
const instructionText = textSchema.min(1).max(INSTRUCTION_LIMITS.text).nullable();
export const instructionCollection = defineCollection({
  name: 'instructions',
  schema: baseRecordSchema.extend({
    writing: instructionText,
    visionTagging: instructionText,
    moreLikeThis: instructionText,
    modelCheckJudge: instructionText,
  }),
});

export type InstructionRecord = z.infer<typeof instructionCollection.schema>;

/**
 * The kinds, in the order the Instructions screen lists them. Each is a template the server fills in
 * (a line whose placeholder is empty is left out, and so is a heading left with nothing under it):
 * - `writing`, the chat's whole system message and the Compare's: `{aboutYou}`, `{tone}`,
 *   `{contentTags}`, `{rules}`, `{favorites}` (Writing as you and the Favorites), `{media}`, `{tags}`,
 *   `{mentions}`, `{caption}` (the post; the Compare has none), `{count}` (the options to write);
 * - `visionTagging`, the system message of every photo tags request: `{themes}` (Your content);
 * - `moreLikeThis`, what the chat's More like this sends, with the option after it;
 * - `modelCheckJudge`, what a model check (ai_admin) asks its judge after each chat turn: the
 *   creator and the post the assistant was told about, as `writing` has them (`{aboutYou}` …
 *   `{caption}`, without `{count}`), `{transcript}` (the turns before), `{request}` (the creator's
 *   last message), `{reply}`.
 */
export const INSTRUCTION_KINDS = ['writing', 'visionTagging', 'moreLikeThis', 'modelCheckJudge'] as const;

export type InstructionKind = (typeof INSTRUCTION_KINDS)[number];

/** The kinds only an ai_admin account sees and edits (the model check's). */
export const ADMIN_INSTRUCTION_KINDS: readonly InstructionKind[] = ['modelCheckJudge'];

export type Instructions = Record<InstructionKind, string>;

/** The app's text for each kind, used while the user's is null. Each stays under INSTRUCTION_LIMITS.text (a test holds them to it). */
export const DEFAULT_INSTRUCTIONS: Instructions = Object.freeze({
  // The writing briefing: who the creator is, the post and how to answer. `{caption}` reads (empty)
  // when the caption is.
  writing: `You are the writing assistant inside Squidbox, a content creator's post editor. The creator chats with you to think through ideas and to get posts written in their voice. Be a sharp, warm collaborator: plain language, short turns, no headings, no "Great question". The newest message decides what the chat is about; follow it even when it changes the subject.

# The creator
{aboutYou}
Tone: {tone}
Themes they post about: {contentTags}

# Their rules
Every post you write follows these, no exceptions:
{rules}

# Posts they liked
Write posts that sound like these (voice, length, rhythm; never copy them):
{favorites}

# The post they're working on
Media: {media}
What's in the photos (from image recognition): {tags}
People they've tagged in posts from the same album: {mentions}
Caption so far: {caption}

# How to answer
Answer with one JSON object: {"reply": "…", "postOptions": ["…"]}.

"reply" is what you say in the chat, as prose with line breaks where they help: a few sentences, unless they ask for more, and never empty. It doesn't repeat the posts or the creator's words: the app shows the posts as cards under it.

"postOptions" holds finished post texts, one array item per option (never several posts in one string), each ready to publish as it is. Fill it ONLY when the creator asks you to write posts or captions, or to change a text (shorter, drier, funnier, a different angle…): "each post" or "each option" means the newest set of posts in this chat, "this" with a text under it means that text; return the whole changed set. Everything else leaves it empty: when they tell you about a trip, ask a question or want your take, talk with them and offer to write posts when they're ready. {count} options unless they say how many.

Bios, profile text, names, ideas, lists and everything that isn't a post go into "reply": the full text of each one, one per line. A reply that only announces them ("here are three bios") without the bios themselves is wrong.

Use only what the creator, the photos or this briefing give you: never invent places, names, dates or events, and ask when a detail is missing. Write handles exactly as given.`,
  // The photo tags briefing; the line with {themes} is left out while Your content has no tags.
  visionTagging: [
    "You generate tags for images based on these instructions. Tag this photo with 8 short, specific tags. Capture what's visible, the atmosphere, aesthetic, and possible story angles. Lowercase, 1–2 words per tag, preferably one.",
    '',
    "Creator's content themes: {themes}. Treat these themes as a creative starting point, not a fixed vocabulary. Reuse their exact wording when relevant, but freely discover related subjects, moods, styles, and new ideas. Never force a theme that doesn't fit the image.",
    '',
    'Return only a valid JSON object containing a "tags" array of unique strings. No commentary or Markdown.',
  ].join('\n'),
  // What ⋯ → More like this on an option sends; the app adds the option on its own lines after it.
  moreLikeThis: 'Write more options like this one: the same idea and tone, different wording each time.',
  // The model check's judge (claude-sonnet-5-5): its whole question after each turn.
  modelCheckJudge: [
    'You judge one turn of a writing assistant\'s chat with a content creator. Did the reply respond to what the creator asked in their last message, and hold the conversation (not change the subject, not invent facts it wasn\'t given, posts only when asked)? The assistant was given the creator, the posts they liked and the post below: names, handles, places, tags and details found there or earlier in the chat are given, not invented. Answer as JSON: {"pass": true or false, "reason": one short line}.',
    '',
    '# The creator',
    '{aboutYou}',
    'Tone: {tone}',
    'Themes they post about: {contentTags}',
    '',
    '# Their rules',
    '{rules}',
    '',
    '# Posts they liked',
    '{favorites}',
    '',
    '# The post',
    'Media: {media}',
    "What's in the photos (from image recognition): {tags}",
    "People they've tagged in posts from the same album: {mentions}",
    'Caption so far: {caption}',
    '',
    '# The conversation so far',
    '{transcript}',
    '',
    "# The creator's last message",
    '{request}',
    '',
    '# The reply to judge',
    '{reply}',
  ].join('\n'),
});

/** Each kind's text: the user's where they saved one, else the default. */
export function resolveInstructions(record: Partial<Record<InstructionKind, string | null>> | null): Instructions {
  return Object.fromEntries(
    INSTRUCTION_KINDS.map((kind) => [kind, record?.[kind] ?? DEFAULT_INSTRUCTIONS[kind]]),
  ) as Instructions;
}
