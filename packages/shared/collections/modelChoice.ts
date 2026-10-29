import { z } from 'zod';
import type { AiModelKind, ModelDefaults, ModelDefaultVariant } from '../contracts/ai';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const MODEL_CHOICE_LIMITS = { modelId: 200, modelName: 200 } as const;

// `model_choices` — an ai_admin's picks of the defaults (the Default and Uncensored default switches
// on a model's page), which their own account uses before Make default for everyone publishes them
// to every account. Per kind: `writingModel`/`visionModel` the pick of the Default (`regular`),
// `writingUncensoredModel`/`visionUncensoredModel` the pick of the Uncensored default
// (`unrestricted`); each its id, and its name for a model Venice no longer offers. Null is no pick:
// the published default (model_defaults). One record per user, whose id is the user's id, like
// `personas`, so every device writes the same record and the per-field merge converges. The
// Uncensored picks are optional, so a push from a build without them keeps the stored value. The
// model list to choose from and the model testing stay on each device.
const modelSchema = z
  .object({
    id: textSchema.min(1).max(MODEL_CHOICE_LIMITS.modelId),
    name: textSchema.max(MODEL_CHOICE_LIMITS.modelName),
  })
  .nullable();

export const modelChoiceCollection = defineCollection({
  name: 'model_choices',
  schema: baseRecordSchema.extend({
    writingModel: modelSchema,
    visionModel: modelSchema,
    writingUncensoredModel: modelSchema.optional(),
    visionUncensoredModel: modelSchema.optional(),
  }),
});

export type ModelChoiceRecord = z.infer<typeof modelChoiceCollection.schema>;

/** The picks themselves: the record without its base columns. */
export type ModelChoiceFields = Pick<
  ModelChoiceRecord,
  'writingModel' | 'visionModel' | 'writingUncensoredModel' | 'visionUncensoredModel'
>;

/** The record's field that holds the pick of each kind's default variant. */
export const MODEL_CHOICE_FIELDS = {
  writing: { regular: 'writingModel', unrestricted: 'writingUncensoredModel' },
  vision: { regular: 'visionModel', unrestricted: 'visionUncensoredModel' },
} as const satisfies Record<AiModelKind, Record<ModelDefaultVariant, keyof ModelChoiceFields>>;

/**
 * The defaults an account uses for `kind`: each variant's pick in `picks` (an ai_admin's record
 * fields; null, or an undefined field, is none), else the published default. The `defaults` are the
 * server's model_defaults; the app gets them with the catalog.
 */
export function resolveModelDefaults(
  kind: AiModelKind,
  picks: Partial<ModelChoiceFields> | null | undefined,
  defaults: ModelDefaults,
): { regular: string; unrestricted: string } {
  const fields = MODEL_CHOICE_FIELDS[kind];
  return {
    regular: picks?.[fields.regular]?.id ?? defaults[kind].regular,
    unrestricted: picks?.[fields.unrestricted]?.id ?? defaults[kind].unrestricted,
  };
}

/**
 * The model the assistant uses for `kind`, the same on the server and in the app: of the defaults
 * the account uses (resolveModelDefaults), the one for the persona's `adultContent` (false while
 * unset).
 */
export function resolveModelId(
  kind: AiModelKind,
  picks: Partial<ModelChoiceFields> | null | undefined,
  adultContent: boolean | undefined,
  defaults: ModelDefaults,
): string {
  return resolveModelDefaults(kind, picks, defaults)[adultContent ? 'unrestricted' : 'regular'];
}
