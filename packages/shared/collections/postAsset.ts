import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `post_assets` — a junction collection: one record per (post, asset) reference. Promoted out of
// the old `post.assetRefs` array (which was `{id, assetId}[]`). The edge `id` is the former
// assetRef sub-id; `position` is a fractional-index key giving order within the post. Same
// rationale as album_assets: add/remove/reorder become independent edge writes that don't clobber.
export const postAssetCollection = defineCollection({
  name: 'post_assets',
  schema: baseRecordSchema.extend({
    postId: z.string().uuid(),
    assetId: z.string().uuid(),
    position: z.string(),
  }),
});

export type PostAssetRecord = z.infer<typeof postAssetCollection.schema>;
