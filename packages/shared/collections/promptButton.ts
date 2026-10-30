import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// Where a prompt button showed before the buttons became one list: on a post, on a new post, under
// the caption, or under every reply (Refine). Retired: a new record takes ONE_LIST_PLACEMENT (the
// schema's default) and the app reads none; the field stays so an older build still syncs.
export const promptButtonPlacementSchema = z.enum(['post', 'newPost', 'caption', 'refine']);
export type PromptButtonPlacement = z.infer<typeof promptButtonPlacementSchema>;
export const ONE_LIST_PLACEMENT: PromptButtonPlacement = 'post';

// `prompt_buttons` — the chat's one-tap prompts (Settings → Assistant → Prompt buttons), one list
// under the post editor's caption and over the chat's message box. `position` is a fractional-index
// key ordering them, by `(position, id)`. Deletion is a tombstone. `icon` is an Icon name or null.
export const promptButtonCollection = defineCollection({
  name: 'prompt_buttons',
  schema: baseRecordSchema.extend({
    name: textSchema.min(1).max(60),
    prompt: textSchema.min(1).max(2000),
    placement: promptButtonPlacementSchema.default(ONE_LIST_PLACEMENT),
    icon: textSchema.max(40).nullable(),
    position: textSchema,
  }),
});

export type PromptButtonRecord = z.infer<typeof promptButtonCollection.schema>;
