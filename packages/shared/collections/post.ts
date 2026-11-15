import { z } from 'zod';
import { baseRecordSchema, defineCollection, int4Schema, textSchema, timestampSchema } from './define';
import { CONTACT_LIMITS } from './contact';

/** How much a post holds at most: mentions in its text; in a channel copy, posts and their assets. */
export const POST_LIMITS = { mentions: 200, copyPosts: 100, copyAssets: 1000 } as const;

/** A contact a post's text mentions: its id, where its name starts (UTF-16 offset) and that name. */
export const postMentionSchema = z.object({
  contactId: z.uuid(),
  location: z.number().int().min(0),
  name: textSchema.min(1).max(CONTACT_LIMITS.name),
});
export type PostMention = z.infer<typeof postMentionSchema>;

/** A post's mentions: null when there is none, never []. */
export const postMentionsSchema = z.array(postMentionSchema).max(POST_LIMITS.mentions).nullable();

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
// Mentions: `mentions` lists the contacts the text mentions, each by its contact id, where its name
// starts in `text` (`location`, a UTF-16 offset) and that name as written there (`name`). The text
// keeps the name, so a reader of the text alone (search, the assistant, an older build) reads it as
// it is; a mention counts only while the text still has its name at its location. Null when there is
// none (never []). Optional, so a push from a build without it keeps the stored value; `text` and
// `mentions` merge as one, so two devices never mix one's text with the other's mentions.
//
// Retired: `channelId`, `channelRootId` and `extraChannelIds` held a post's channel versions (builds up
// to 20261114-e71be8cf). The app no longer reads or writes them; they stay, optional, for the installed
// builds that still push and read them, until the last contract snapshot that has them is retired
// (sync-design §10).
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
    mentions: postMentionsSchema.optional(),
  }),
  fieldGroups: [
    ['channelId', 'extraChannelIds'],
    ['text', 'mentions'],
  ],
});

export type PostRecord = z.infer<typeof postCollection.schema>;
