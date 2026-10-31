import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const INSTRUCTION_LIMITS = { text: 4000 } as const;

// `instructions` — what the assistant is told (Settings → Assistant → Admin → Instructions, for an
// ai_admin account), one text per kind, each that account's to edit. One record per user, whose id is the user's id, like `personas`, so
// two devices editing different kinds converge. Null is "the app's default" (resolveInstructions),
// so a reset is a per-field write like any edit.
export const instructionTextSchema = textSchema.min(1).max(INSTRUCTION_LIMITS.text);
const instructionText = instructionTextSchema.nullable();
export const instructionCollection = defineCollection({
  name: 'instructions',
  schema: baseRecordSchema.extend({
    writing: instructionText,
    visionTagging: instructionText,
    moreLikeThis: instructionText,
    // Optional: the builds before it push instructions without it (sync-design §6, a new synced
    // column is optional and the server ships first); its stored value stays as it is then.
    modelCheckJudge: instructionText.optional(),
  }),
});

export type InstructionRecord = z.infer<typeof instructionCollection.schema>;

/**
 * The kinds, in the order the Instructions screen lists them. Each is a template the server fills in
 * (a line whose placeholder is empty is left out, and so is a heading left with nothing under it):
 * - `writing`, the chat's whole system message: `{aboutYou}`, `{tone}`, `{contentTags}`, `{rules}`,
 *   `{posts}` (Writing as you and a sample of their posts), `{media}`, `{tags}`, `{mentions}`, `{caption}`
 *   (the post), `{count}` (the options to write). A Compare sends only its prompt box;
 * - `visionTagging`, the system message of every photo tags request: `{themes}` (Your content). A
 *   Compare sends its prompt box in its place, without the themes;
 * - `moreLikeThis`, what the chat's More like this sends, with the option after it;
 * - `modelCheckJudge`, what a writing Verify (ai_admin) asks its judge after each chat turn: the
 *   creator and the post the assistant was told about, as `writing` has them (`{aboutYou}` …
 *   `{caption}`, without `{count}`), `{transcript}` (the turns before), `{request}` (the creator's
 *   last message), `{reply}`.
 */
export const INSTRUCTION_KINDS = ['writing', 'visionTagging', 'moreLikeThis', 'modelCheckJudge'] as const;

// The placeholders the server fills in each kind (see INSTRUCTION_KINDS); a text without one leaves
// that out of what the assistant gets.
const CREATOR_AND_POST = ['aboutYou', 'tone', 'contentTags', 'rules', 'posts', 'media', 'tags', 'mentions', 'caption'];
export const INSTRUCTION_PLACEHOLDERS: Readonly<Record<InstructionKind, readonly string[]>> = Object.freeze({
  writing: [...CREATOR_AND_POST, 'count'],
  visionTagging: ['themes'],
  moreLikeThis: [],
  modelCheckJudge: [...CREATOR_AND_POST, 'transcript', 'request', 'reply'],
});

/** The placeholders of `kind` that `text` lacks, as INSTRUCTION_PLACEHOLDERS orders them. */
export function missingPlaceholders(kind: InstructionKind, text: string): string[] {
  return INSTRUCTION_PLACEHOLDERS[kind].filter((name) => !text.includes(`{${name}}`));
}

export const instructionKindSchema = z.enum(INSTRUCTION_KINDS);

export type InstructionKind = (typeof INSTRUCTION_KINDS)[number];

// Every kind's text, as the assistant gets it.
export const instructionsSchema = z.object(
  Object.fromEntries(INSTRUCTION_KINDS.map((kind) => [kind, z.string()])) as Record<InstructionKind, z.ZodString>,
);
export type Instructions = z.infer<typeof instructionsSchema>;

/**
 * The built-in text for each kind: the app's default while nothing was published for it (Apply
 * changes for everyone, the server's app_instructions). Each stays under INSTRUCTION_LIMITS.text (a
 * test holds them to it).
 */
export const DEFAULT_INSTRUCTIONS: Instructions = Object.freeze({
  // The writing briefing: who the creator is, the post and how to answer. `{caption}` reads (empty)
  // when the caption is.
  writing: `You are a writing assistant for a content creator. They chat with you to explore ideas and write posts in their voice. Be a sharp, warm collaborator: plain language, short turns, no unnecessary headings, no "Great question". Follow the latest message, using conversation history to understand references and maintain continuity. If the creator changes the subject, follow them.

# The creator
{aboutYou}
Tone: {tone}
Themes they post about: {contentTags}

# Their rules
Every post you write follows these, no exceptions:
{rules}

# Posts they wrote
Write posts that sound like these (voice, length, rhythm; never copy them):
{posts}

# The post they're working on
Media: {media}
What's in the photos (from image recognition): {tags}
People they've tagged in posts from the same album: {mentions}
Their post so far: {caption}

This is the current state of the post. Use conversation history for context and previous suggestions, but prefer the current post context when details differ.

# How to answer
Follow the creator's rules first, then their current request. Use their posts as the strongest guide to their writing style, with tone and themes as additional guidance.

Return exactly one JSON object:
{"reply": "…", "postOptions": ["…"]}

"reply" is your conversational response. Keep it natural, concise and useful. It can be empty when postOptions already answers the request. Don't introduce, summarize or repeat the posts shown below it. When postOptions is empty, reply must not be empty.

"postOptions" contains finished, ready-to-publish posts, one per array item. Fill it when the creator explicitly or implicitly wants posts, captions, or revisions of existing posts. Otherwise leave it empty and converse naturally. Use {count} options unless the creator specifies otherwise.

Use the conversation history to understand revisions and references. "Each post", "each option", or "all" refers to the latest set of posts. "This" with a specific text refers to that text. When asked to revise all options, return the complete revised set. When asked to revise a specific option, return only that revised option.

Don't force post generation when the creator is simply chatting, asking questions or exploring ideas. Take initiative when their intent to get publishable text is clear, even without an explicit command.

Bios, profile text, names, ideas, lists and anything that isn't a post go into "reply", not postOptions. Include the actual requested content, not just an introduction. For multiple suggestions, put each on its own line.

Write handles exactly as given.`,
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
  // Verify's judge (VERIFY_JUDGE_MODEL_ID in contracts/ai.ts): its whole question after each turn.
  modelCheckJudge: [
    'You judge one turn of a writing assistant\'s chat with a content creator. Did the reply respond to what the creator asked in their last message, and hold the conversation (not change the subject, not invent facts it wasn\'t given, posts only when asked)? The assistant was given the creator, posts they wrote and the post below: names, handles, places, tags and details found there or earlier in the chat are given, not invented. Answer as JSON: {"pass": true or false, "reason": one short line}.',
    '',
    '# The creator',
    '{aboutYou}',
    'Tone: {tone}',
    'Themes they post about: {contentTags}',
    '',
    '# Their rules',
    '{rules}',
    '',
    '# Posts they wrote',
    '{posts}',
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

/**
 * Each kind's text: the user's where they saved one, else the app's default from `defaults` (the
 * published text, else the built-in one). `defaults` is required, so no caller skips the published
 * text by accident.
 */
export function resolveInstructions(
  record: Partial<Record<InstructionKind, string | null>> | null,
  defaults: Instructions,
): Instructions {
  return Object.fromEntries(INSTRUCTION_KINDS.map((kind) => [kind, record?.[kind] ?? defaults[kind]])) as Instructions;
}
