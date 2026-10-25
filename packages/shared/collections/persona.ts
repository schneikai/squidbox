import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// `personas` — "Writing as you" (Settings → Assistant): what the assistant writes with. One record
// per user, whose id is the user's id, so every device writes the same record and the per-field
// merge converges. The lists are JSON values that merge as a whole, each with its own clock.
export const PERSONA_LIMITS = {
  aboutYou: 2000,
  tone: 1000,
  contentTags: 50,
  contentTag: 40,
  rules: 30,
  rule: 200,
  examplePosts: 10,
  examplePost: 2000,
} as const;

const textList = (count: number, length: number) => z.array(textSchema.max(length)).max(count);

export const personaCollection = defineCollection({
  name: 'personas',
  schema: baseRecordSchema.extend({
    aboutYou: textSchema.max(PERSONA_LIMITS.aboutYou),
    contentTags: textList(PERSONA_LIMITS.contentTags, PERSONA_LIMITS.contentTag),
    tone: textSchema.max(PERSONA_LIMITS.tone),
    useEmoji: z.boolean(),
    rules: textList(PERSONA_LIMITS.rules, PERSONA_LIMITS.rule),
    examplePosts: textList(PERSONA_LIMITS.examplePosts, PERSONA_LIMITS.examplePost),
  }),
});

export type PersonaRecord = z.infer<typeof personaCollection.schema>;

/** The persona's own fields (all but the base columns), in the order the screen shows them. */
export const PERSONA_FIELDS = ['aboutYou', 'contentTags', 'tone', 'useEmoji', 'rules', 'examplePosts'] as const;

export type PersonaFields = Pick<PersonaRecord, (typeof PERSONA_FIELDS)[number]>;
