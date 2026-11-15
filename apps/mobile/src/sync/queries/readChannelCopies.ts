import postQuery from './postQuery';
import readPost from './readPost';
import readPostCopies, { postCopiesTables, type PostCopyWithAssets } from './readPostCopies';

import { readChannels } from '@/sync/channelsRepository';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { copyIdOf, readRemovedChannelIds } from '@/sync/postCopiesRepository';
import postAsCopyPosts from '@/utils/posts/postAsCopyPosts';

/**
 * A card of Send to channels: a stored copy of the post for a channel, or (`followsPost`) an untouched
 * card, not stored, that shows the post and its thread as they are now, under the id its record will
 * get (`copyIdOf`), unsent.
 */
export type ChannelCopy = Pick<PostCopyWithAssets, 'id' | 'postId' | 'channelId' | 'sentAt' | 'posts'> & {
  followsPost: boolean;
};

/** What Send to channels shows of a post: its cards, and the user's channels + can add back. */
export type ChannelCopies = { copies: ChannelCopy[]; addableChannelIds: string[] };

/** The tables a read of a post's cards watches: its copies, the user's channels and the post. */
export function channelCopiesTables(postId: string) {
  return [...new Set([...postCopiesTables, schema.channels, ...postQuery({ scope: { postId } }).tables])];
}

/**
 * A post's cards, in one transaction: for each of the user's channels in their order, its live copies,
 * or an untouched card when the post has no copy for it at all (a removed one, a tombstone, keeps the
 * card away); then the copies of channels no longer in the user's channels, in the order they were
 * added. `addableChannelIds`: the user's channels without a card, in their order (the removed ones).
 * A deleted post reads as its stored copies. A channel this build doesn't know is not left out here.
 */
export default function readChannelCopies(db: SyncDb, postId: string): Promise<ChannelCopies> {
  return db.transaction(async (tx) => {
    const stored = (await readPostCopies(tx, postId)).map(({ id, channelId, sentAt, posts }): ChannelCopy => ({
      id,
      postId,
      channelId,
      sentAt,
      posts,
      followsPost: false,
    }));
    const removed = new Set(await readRemovedChannelIds(tx, postId));
    const channelIds = (await readChannels(tx)).map((channel) => channel.channelId);
    const withCopy = new Set(stored.map((copy) => copy.channelId));
    const untouched = channelIds.filter((channelId) => !withCopy.has(channelId) && !removed.has(channelId));
    const post = untouched.length > 0 ? await readPost(tx, postId) : null;
    const posts = post && postAsCopyPosts(post);
    const copies = channelIds.flatMap((channelId): ChannelCopy[] => {
      if (withCopy.has(channelId)) return stored.filter((copy) => copy.channelId === channelId);
      if (!posts || removed.has(channelId)) return [];
      return [{ id: copyIdOf(postId, channelId), postId, channelId, sentAt: null, posts, followsPost: true }];
    });
    const inSettings = new Set(channelIds);
    return {
      copies: [...copies, ...stored.filter((copy) => !inSettings.has(copy.channelId))],
      addableChannelIds: channelIds.filter((channelId) => !withCopy.has(channelId) && removed.has(channelId)),
    };
  });
}

/** One card of the post's (by its id, stored or fixed), or null when it has none. */
export async function readChannelCopy(db: SyncDb, postId: string, copyId: string): Promise<ChannelCopy | null> {
  return (await readChannelCopies(db, postId)).copies.find((copy) => copy.id === copyId) ?? null;
}
