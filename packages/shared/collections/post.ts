import { z } from 'zod';
import { baseRecordSchema, defineCollection, int4Schema, textSchema, timestampSchema } from './define';

// `posts` collection (sync-design §10). Asset references live in the `post_assets` edge
// collection. suggestRepostAt is a non-null number (defaults to createdAt in the app). Deletion
// is a `deletedAt` tombstone.
//
// Threads: a following post carries `threadRootId` (the thread's first post) and `threadIndex` (its
// place after it, 1 = right after; gaps are fine, ordered by (threadIndex, id)). Both are optional and
// null while unset, so a push from a build without them keeps the stored values, and an older build
// sees the following posts as ordinary posts. Readers show a thread as its first post; a following
// post whose first post is deleted reads as a post of its own.
export const postCollection = defineCollection({
  name: 'posts',
  schema: baseRecordSchema.extend({
    text: textSchema,
    isFavorite: z.boolean(),
    postedAt: timestampSchema.nullable(),
    rePostId: z.string().uuid().nullable(),
    isIgnoredForRepost: z.boolean(),
    suggestRepostAt: timestampSchema,
    hasBeenReposted: z.boolean(),
    threadRootId: z.string().uuid().nullable().optional(),
    threadIndex: int4Schema.nullable().optional(),
  }),
});

export type PostRecord = z.infer<typeof postCollection.schema>;
