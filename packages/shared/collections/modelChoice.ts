import { z } from 'zod';
import type { AiModelKind } from '../contracts/ai';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const MODEL_CHOICE_LIMITS = { modelId: 200, modelName: 200 } as const;

// The model the assistant uses for each kind while the user has chosen none, per the persona's
// Adult content switch: `unrestricted` while it is on, `regular` while it is off.
export const DEFAULT_MODEL_IDS: Record<AiModelKind, { regular: string; unrestricted: string }> = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'gemma-4-uncensored' },
};

/** The default model of `kind` for the persona's `adultContent` (false while unset). */
export function defaultModelId(kind: AiModelKind, adultContent: boolean | undefined): string {
  return DEFAULT_MODEL_IDS[kind][adultContent ? 'unrestricted' : 'regular'];
}

/**
 * The model the assistant uses for `kind`, the same on the server and in the app: the one the user
 * chose (`chosen`, null for none), else the default for the persona's `adultContent`.
 */
export function resolveModelId(
  kind: AiModelKind,
  chosen: { id: string } | null | undefined,
  adultContent: boolean | undefined,
): string {
  return chosen?.id ?? defaultModelId(kind, adultContent);
}

// The models Squidbox checked itself for each kind (writing: `npm run check:chat-models` in
// apps/server, results in the post-chat model recommendations; vision: the photo tags), marked
// Verified in the model lists, and the writing list's first run. `unrestricted`: an uncensored model.
export const VERIFIED_MODELS: Record<AiModelKind, readonly { id: string; unrestricted: boolean }[]> = {
  writing: [
    { id: 'deepseek-v4-1-flash-uncensored', unrestricted: true },
    { id: 'abliteration-abliterated-model-large-flash', unrestricted: true },
    { id: 'claude-sonnet-5-5', unrestricted: false },
    { id: 'kimi-k3', unrestricted: false },
    { id: 'grok-4-7', unrestricted: false },
    { id: 'openai-gpt-6-luna', unrestricted: false },
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
