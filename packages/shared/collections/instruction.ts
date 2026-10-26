import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const INSTRUCTION_LIMITS = { text: 4000 } as const;

// `instructions` — what the assistant is told before each request (Settings → Assistant →
// Instructions), one text per kind. One record per user, whose id is the user's id, like
// `personas`, so two devices editing different kinds converge. Null is "the app's default", so a
// reset is a per-field write like any edit. The reply format each kind needs (how many posts, the
// JSON) isn't here: the server adds it.
export const instructionCollection = defineCollection({
  name: 'instructions',
  schema: baseRecordSchema.extend({
    writing: textSchema.min(1).max(INSTRUCTION_LIMITS.text).nullable(),
    visionTagging: textSchema.min(1).max(INSTRUCTION_LIMITS.text).nullable(),
  }),
});

export type InstructionRecord = z.infer<typeof instructionCollection.schema>;

/** The kinds, in the order the Instructions screen lists them. */
export const INSTRUCTION_KINDS = ['writing', 'visionTagging'] as const;

export type InstructionKind = (typeof INSTRUCTION_KINDS)[number];

export type Instructions = Record<InstructionKind, string>;

/** The app's text for each kind, used while the user's is null. */
export const DEFAULT_INSTRUCTIONS: Instructions = Object.freeze({
  writing: 'You write social posts for a content creator, in their voice. Each post is ready to publish as it is.',
  visionTagging:
    "Tag this photo with 8 short, specific tags. Capture what's visible, the atmosphere, aesthetic, and " +
    'possible story angles. Lowercase, 1–2 words per tag, preferably one.',
});

/** Each kind's text: the user's where they saved one, else the default. */
export function resolveInstructions(record: Partial<Record<InstructionKind, string | null>> | null): Instructions {
  return Object.fromEntries(
    INSTRUCTION_KINDS.map((kind) => [kind, record?.[kind] ?? DEFAULT_INSTRUCTIONS[kind]]),
  ) as Instructions;
}
