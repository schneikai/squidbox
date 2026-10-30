import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// `personas` — "Writing as you" (Settings → Assistant): what the assistant writes with. One record
// per user, whose id is the user's id, so every device writes the same record and the per-field
// merge converges. The lists are JSON values that merge as a whole, each with its own clock. The
// posts it writes like are Favorites (`favorites`), one record each. `adultContent` picks the
// default model (resolveModelId, from the server's model_defaults); optional, so a push from a
// build without it keeps the stored value, and false while unset.
export const PERSONA_LIMITS = {
  aboutYou: 2000,
  tone: 1000,
  contentTags: 50,
  contentTag: 40,
  rules: 30,
  rule: 200,
} as const;

const textList = (count: number, length: number) => z.array(textSchema.max(length)).max(count);

export const personaCollection = defineCollection({
  name: 'personas',
  schema: baseRecordSchema.extend({
    aboutYou: textSchema.max(PERSONA_LIMITS.aboutYou),
    contentTags: textList(PERSONA_LIMITS.contentTags, PERSONA_LIMITS.contentTag),
    tone: textSchema.max(PERSONA_LIMITS.tone),
    rules: textList(PERSONA_LIMITS.rules, PERSONA_LIMITS.rule),
    adultContent: z.boolean().optional(),
  }),
});

export type PersonaRecord = z.infer<typeof personaCollection.schema>;

/** The persona's own fields (all but the base columns), in the order the screen shows them. */
export const PERSONA_FIELDS = ['aboutYou', 'tone', 'contentTags', 'rules', 'adultContent'] as const;

export type PersonaFields = Pick<PersonaRecord, (typeof PERSONA_FIELDS)[number]>;
