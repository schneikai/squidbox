import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// Where a prompt button shows in the chat: on a post, on a new post, or under every reply (Refine).
export const promptButtonPlacementSchema = z.enum(['post', 'newPost', 'refine']);
export type PromptButtonPlacement = z.infer<typeof promptButtonPlacementSchema>;

// `prompt_buttons` — the chat's one-tap prompts (Settings → Assistant → Prompt buttons). `position`
// is a fractional-index key ordering the buttons within their placement, by `(position, id)`. A
// button for two places is two records. Deletion is a tombstone. `icon` is an Icon name or null.
export const promptButtonCollection = defineCollection({
  name: 'prompt_buttons',
  schema: baseRecordSchema.extend({
    name: textSchema.min(1).max(60),
    prompt: textSchema.min(1).max(2000),
    placement: promptButtonPlacementSchema,
    icon: textSchema.max(40).nullable(),
    position: textSchema,
  }),
});

export type PromptButtonRecord = z.infer<typeof promptButtonCollection.schema>;
