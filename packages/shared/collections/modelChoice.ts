import { z } from 'zod';
import type { AiModelKind } from '../contracts/ai';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const MODEL_CHOICE_LIMITS = { modelId: 200, modelName: 200 } as const;

// The model the assistant uses for each kind while the user has chosen none.
export const DEFAULT_MODEL_IDS: Record<AiModelKind, string> = {
  writing: 'venice-uncensored-1-2',
  vision: 'gemma-4-uncensored',
};

// The models Squidbox checked itself for each kind (writing: `npm run check:chat-models` in
// apps/server; vision: the photo tags), marked Verified in the model lists. `unrestricted`: an
// uncensored model, for a later adult-content switch.
export const VERIFIED_MODELS: Record<AiModelKind, readonly { id: string; unrestricted: boolean }[]> = {
  writing: [
    { id: 'deepseek-v4-1-flash-uncensored', unrestricted: true },
    { id: 'venice-uncensored-1-2', unrestricted: true },
    { id: 'qwen-3-6-plus', unrestricted: true },
  ],
  vision: [{ id: 'gemma-4-uncensored', unrestricted: true }],
};

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
