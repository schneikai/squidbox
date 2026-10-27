import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const INSTRUCTION_LIMITS = { text: 4000 } as const;

// `instructions` — what the assistant is told before each request (Settings → Assistant →
// Instructions), one text per kind. One record per user, whose id is the user's id, like
// `personas`, so two devices editing different kinds converge. Null is "the app's default", so a
// reset is a per-field write like any edit. The reply format each kind needs (how many posts, the
// JSON) isn't here: the server adds it. The app prompts (APP_PROMPT_KINDS) are the server's own
// texts around them, editable per account for trying a change before it goes into the app.
const instructionText = textSchema.min(1).max(INSTRUCTION_LIMITS.text).nullable();
export const instructionCollection = defineCollection({
  name: 'instructions',
  schema: baseRecordSchema.extend({
    writing: instructionText,
    visionTagging: instructionText,
    writingFormat: instructionText,
    tagsSystem: instructionText,
    themesContext: instructionText,
    personaFraming: instructionText,
    chatContext: instructionText,
    moreLikeThis: instructionText,
  }),
});

export type InstructionRecord = z.infer<typeof instructionCollection.schema>;

/** The kinds, in the order the Instructions screen lists them. */
export const INSTRUCTION_KINDS = ['writing', 'visionTagging'] as const;

/**
 * The app's own prompt texts, in the order the Instructions screen's App prompts lists them. Each is a
 * template the server fills in: `{count}` (writingFormat, the Compare's reply format), `{themes}`
 * (themesContext), `{aboutYou}`, `{tone}`, `{contentTags}`, `{rules}`, `{favorites}` (personaFraming,
 * the Compare's), and `{aboutYou}`, `{tone}`, `{contentTags}`, `{rules}`, `{favorites}`, `{media}`,
 * `{tags}`, `{mentions}`, `{caption}`, `{count}` (chatContext, the whole chat briefing). moreLikeThis
 * is the app's: it sends it with the option after it.
 */
export const APP_PROMPT_KINDS = [
  'writingFormat',
  'tagsSystem',
  'themesContext',
  'personaFraming',
  'chatContext',
  'moreLikeThis',
] as const;

export type InstructionKind = (typeof INSTRUCTION_KINDS)[number] | (typeof APP_PROMPT_KINDS)[number];

const ALL_KINDS = [...INSTRUCTION_KINDS, ...APP_PROMPT_KINDS];

export type Instructions = Record<InstructionKind, string>;

/** The app's text for each kind, used while the user's is null. */
export const DEFAULT_INSTRUCTIONS: Instructions = Object.freeze({
  // The Compare's writing instructions; the chat has its own briefing (chatContext).
  writing: 'You write social posts for a content creator, in their voice. Each post is ready to publish as it is.',
  visionTagging:
    "Tag this photo with 8 short, specific tags. Capture what's visible, the atmosphere, aesthetic, and " +
    'possible story angles. Lowercase, 1–2 words per tag, preferably one.',
  // The Compare's reply format, after the writing instructions, which the reply's schema relies on
  // (the chat's is in chatContext).
  writingFormat:
    'Reply with exactly {count} posts, each only the finished post text, no numbering, quotes or commentary, ' +
    'as a JSON object: {"tweets": [...]}.',
  tagsSystem:
    "You generate tags for images based on the user's instructions and any provided context. " +
    'Return only a valid JSON object containing a "tags" array of unique strings. No commentary or Markdown.',
  // Added after the Photo tags instructions when the creator named their content.
  themesContext:
    "Creator's content themes: {themes}\n\n" +
    'Treat these themes as a creative starting point, not a fixed vocabulary. Reuse their exact wording ' +
    'when relevant, but freely discover related subjects, moods, styles, and new ideas. Never force a ' +
    "theme that doesn't fit the image.",
  // Writing as you and the Favorites, in the Compare's writing system message (the chat has its
  // briefing). A line whose placeholder is empty is left out, and so is a heading line ending in ':'
  // right above it.
  personaFraming: [
    'About the creator: {aboutYou}',
    'Their tone: {tone}',
    'Their content: {contentTags}',
    'Rules, always follow them:',
    '{rules}',
    'Example posts they wrote. Write like these:',
    '{favorites}',
  ].join('\n'),
  // The chat briefing (the kind keeps its first name, chatContext): the one prompt the chat sends, as
  // the whole system message, holding who the creator is, the post and how to answer. A line whose
  // placeholder is empty is left out, and so is a heading left with nothing under it (fillLines);
  // `{caption}` reads (empty) when the caption is. It and any edit stay under INSTRUCTION_LIMITS.text
  // (a test holds every default to it).
  chatContext: `You are the writing assistant inside Squidbox, a content creator's post editor. The creator chats with you to think through ideas and to get posts written in their voice. Be a sharp, warm collaborator: plain language, short turns, no headings, no "Great question". The newest message decides what the chat is about; follow it even when it changes the subject.

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
  // What ⋯ → More like this on an option sends; the app adds the option on its own lines after it.
  moreLikeThis: 'Write more options like this one: the same idea and tone, different wording each time.',
});

const APP_PROMPTS: ReadonlySet<InstructionKind> = new Set(APP_PROMPT_KINDS);

/**
 * Each kind's text: the user's where they saved one, else the default. The user's own App prompts
 * (APP_PROMPT_KINDS) apply only to an ai_admin account (`isAiAdmin`); anyone else gets the app's.
 */
export function resolveInstructions(
  record: Partial<Record<InstructionKind, string | null>> | null,
  { isAiAdmin = false }: { isAiAdmin?: boolean } = {},
): Instructions {
  return Object.fromEntries(
    ALL_KINDS.map((kind) => {
      const own = isAiAdmin || !APP_PROMPTS.has(kind) ? record?.[kind] : null;
      return [kind, own ?? DEFAULT_INSTRUCTIONS[kind]];
    }),
  ) as Instructions;
}
