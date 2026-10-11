import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `posts` collection (sync-design §10). Asset references live in the `post_assets` edge
// collection. suggestRepostAt is a non-null number (defaults to createdAt in the app). Deletion
// is a `deletedAt` tombstone.
export const postCollection = defineCollection({
  name: 'posts',
  schema: baseRecordSchema.extend({
    text: z.string(),
    isFavorite: z.boolean(),
    postedAt: z.number().nullable(),
    rePostId: z.string().uuid().nullable(),
    isIgnoredForRepost: z.boolean(),
    suggestRepostAt: z.number(),
    hasBeenReposted: z.boolean(),
  }),
});

export type PostRecord = z.infer<typeof postCollection.schema>;
