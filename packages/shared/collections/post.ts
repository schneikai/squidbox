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
//
// Channels: `channelId` is the catalog id of the channel the post is on (channels.ts; null: none). A
// post's other channels are posts of their own, each carrying `channelRootId` (the post they are
// another channel of) and its own channelId, edges and thread. Both are optional and null while unset,
// so a push from a build without them keeps the stored values, and an older build sees a post's other
// channels as ordinary posts. Readers show a post as itself with its other channels; another channel
// whose post is deleted reads as a post of its own.
//
// A version (the post or another channel of it) can go to several channels: `extraChannelIds` are
// the channels it also goes to besides `channelId`, in the order they were added. Null unless the
// version has two or more channels (never []). Optional, so a push from a build without it keeps
// the stored value; an older build shows the version under `channelId` only. The two merge as one.
export const postCollection = defineCollection({
  name: 'posts',
  schema: baseRecordSchema.extend({
    text: textSchema,
    isFavorite: z.boolean(),
    postedAt: timestampSchema.nullable(),
    rePostId: z.uuid().nullable(),
    isIgnoredForRepost: z.boolean(),
    suggestRepostAt: timestampSchema,
    hasBeenReposted: z.boolean(),
    threadRootId: z.uuid().nullable().optional(),
    threadIndex: int4Schema.nullable().optional(),
    channelId: textSchema.max(40).nullable().optional(),
    channelRootId: z.string().uuid().nullable().optional(),
    extraChannelIds: z.array(textSchema.min(1).max(40)).max(50).nullable().optional(),
  }),
  fieldGroups: [['channelId', 'extraChannelIds']],
});

export type PostRecord = z.infer<typeof postCollection.schema>;
