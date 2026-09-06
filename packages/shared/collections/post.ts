import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `posts` collection (sync-design §10). `assetRefs` is an ordered JSON array of {id, assetId}.
// suggestRepostAt is a non-null number (defaults to createdAt in the app). Legacy `isDeleted`
// → modern `deletedAt` tombstone.
export const postCollection = defineCollection({
  name: 'posts',
  schema: baseRecordSchema.extend({
    text: z.string(),
    assetRefs: z.array(z.object({ id: z.string(), assetId: z.string() })),
    isFavorite: z.boolean(),
    postedAt: z.number().nullable(),
    rePostId: z.string().nullable(),
    isIgnoredForRepost: z.boolean(),
    suggestRepostAt: z.number(),
    hasBeenReposted: z.boolean(),
  }),
});

export type PostRecord = z.infer<typeof postCollection.schema>;
