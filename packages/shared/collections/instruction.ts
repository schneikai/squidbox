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
  }),
});

export type InstructionRecord = z.infer<typeof instructionCollection.schema>;

/** The kinds, in the order the Instructions screen lists them. */
export const INSTRUCTION_KINDS = ['writing', 'visionTagging'] as const;

/**
 * The app's own prompt texts, in the order the Instructions screen's App prompts lists them. Each is a
 * template the server fills in: `{count}` (writingFormat), `{themes}` (themesContext), and `{aboutYou}`,
 * `{tone}`, `{contentTags}`, `{rules}`, `{favorites}` (personaFraming).
 */
export const APP_PROMPT_KINDS = ['writingFormat', 'tagsSystem', 'themesContext', 'personaFraming'] as const;

export type InstructionKind = (typeof INSTRUCTION_KINDS)[number] | (typeof APP_PROMPT_KINDS)[number];

const ALL_KINDS = [...INSTRUCTION_KINDS, ...APP_PROMPT_KINDS];

export type Instructions = Record<InstructionKind, string>;

/** The app's text for each kind, used while the user's is null. */
export const DEFAULT_INSTRUCTIONS: Instructions = Object.freeze({
  writing: 'You write social posts for a content creator, in their voice. Each post is ready to publish as it is.',
  visionTagging:
    "Tag this photo with 8 short, specific tags. Capture what's visible, the atmosphere, aesthetic, and " +
    'possible story angles. Lowercase, 1–2 words per tag, preferably one.',
  // The reply format after the writing instructions, which the reply's schema relies on.
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
  // Writing as you and the Favorites, in the writing system message. A line whose placeholder is empty
  // is left out, and so is a heading line ending in ':' right above it.
  personaFraming: [
    'About the creator: {aboutYou}',
    'Their tone: {tone}',
    'Their content: {contentTags}',
    'Rules, always follow them:',
    '{rules}',
    'Example posts they wrote. Write like these:',
    '{favorites}',
  ].join('\n'),
});

/** Each kind's text: the user's where they saved one, else the default. */
export function resolveInstructions(record: Partial<Record<InstructionKind, string | null>> | null): Instructions {
  return Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, record?.[kind] ?? DEFAULT_INSTRUCTIONS[kind]]),
  ) as Instructions;
}
