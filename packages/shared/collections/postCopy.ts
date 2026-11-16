import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';
import { POST_LIMITS, postMentionsSchema } from './post';

/** One post of a channel copy, in thread order: its text, the contacts it mentions and its assets in order. */
export const postCopyPostSchema = z.object({
  text: textSchema,
  mentions: postMentionsSchema,
  assetIds: z.array(z.uuid()).max(POST_LIMITS.copyAssets),
});
export type PostCopyPost = z.infer<typeof postCopyPostSchema>;

// `post_copies` — a post as it goes to one channel (Send to channels): `postId` the post, `channelId`
// the catalog id of the channel (channels.ts; free text, so a build keeps a channel a newer build
// added), `sentAt` when it was sent (null until then), and `posts` the copy's posts in thread order
// (the first, then its thread), each `{ text, mentions, assetIds }`. A copy is saved whole by its
// composer, so `posts` merges as one value: two devices editing one copy keep the later save. An
// asset id that no longer resolves (a purged asset) is skipped by the readers. `followsPost`
// (optional, null | boolean) is true for a copy stored from a card that showed the post as it is now
// (Send now, Send all or Remove on it): unsent, it keeps showing the post. False or missing (a copy
// saved in its composer, any copy an older build wrote) is the channel's own copy, so `posts` and
// `followsPost` are one field group. `removedAt` (optional, null | epoch ms) is when the user took
// the channel off the post: no card shows for it until + clears it. Deletion is a tombstone;
// deleting a post tombstones its copies.
export const postCopyCollection = defineCollection({
  name: 'post_copies',
  schema: baseRecordSchema.extend({
    postId: z.uuid(),
    channelId: textSchema.min(1).max(40),
    sentAt: timestampSchema.nullable(),
    posts: z.array(postCopyPostSchema).min(1).max(POST_LIMITS.copyPosts),
    followsPost: z.boolean().nullable().optional(),
    removedAt: timestampSchema.nullable().optional(),
  }),
  fieldGroups: [['posts', 'followsPost']],
});

export type PostCopyRecord = z.infer<typeof postCopyCollection.schema>;
