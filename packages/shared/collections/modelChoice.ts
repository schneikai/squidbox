import { z } from 'zod';
import type { AiModelKind, ModelDefaults } from '../contracts/ai';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const MODEL_CHOICE_LIMITS = { modelId: 200, modelName: 200 } as const;

/**
 * The model the assistant uses for `kind`, the same on the server and in the app: the one the user
 * chose (`chosen`, null for none), else the default for the persona's `adultContent` (false while
 * unset). The `defaults` are the server's model_defaults; the app gets them with the catalog.
 */
export function resolveModelId(
  kind: AiModelKind,
  chosen: { id: string } | null | undefined,
  adultContent: boolean | undefined,
  defaults: ModelDefaults,
): string {
  return chosen?.id ?? defaults[kind][adultContent ? 'unrestricted' : 'regular'];
}

// `model_choices` — the model the assistant uses for each kind (Settings → Assistant → Models), when
// the user chose one: its id, and its name for a model Venice no longer offers. One record per user,
// whose id is the user's id, like `personas`, so every device writes the same record and the per-field
// merge converges. Null is no choice: the app's default. The model list to choose from and the model
// testing stay on each device.
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
  }),
});

export type ModelChoiceRecord = z.infer<typeof modelChoiceCollection.schema>;
