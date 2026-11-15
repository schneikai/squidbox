import { channelById, type Channel } from '@squidbox/shared';

import readPost, { readPostTables } from './readPost';
import readPostCopies, { postCopiesTables, type PostCopyWithAssets } from './readPostCopies';

import { readChannels } from '@/sync/channelsRepository';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { copyIdOf, followsPost } from '@/sync/postCopiesRepository';
import postAsCopyPosts from '@/utils/posts/postAsCopyPosts';

/**
 * A card of Send to channels, for its channel: a stored copy of the post, or (`followsPost`) one that
 * shows the post and its thread as they are now: an untouched card, not stored, under the id its
 * record will get (`copyIdOf`), or a stored copy never sent nor saved in its composer.
 */
export type ChannelCopy = Pick<PostCopyWithAssets, 'id' | 'postId' | 'channelId' | 'sentAt' | 'posts'> & {
  channel: Channel;
  followsPost: boolean;
};

/**
 * What Send to channels shows of a post: its cards, the user's channels + can add back (`addable`)
 * and whether the user has any channel.
 */
export type ChannelCopies = { copies: ChannelCopy[]; addable: Channel[]; hasChannels: boolean };

/** The tables a read of a post's cards watches: its copies, the user's channels and the post. */
export const channelCopiesTables = [...new Set([...postCopiesTables, schema.channels, ...readPostTables])];

/**
 * A post's cards, in one transaction, or null when the post doesn't exist: for each of the user's
 * channels in their order, its copies, or an untouched card when it has none; a channel whose copies
 * the user removed (`removedAt`) has no card and is `addable`. Then the sent and saved copies of
 * channels no longer in the user's channels, in the order they were added. A channel this build
 * doesn't know is left out.
 */
export default function readChannelCopies(db: SyncDb, postId: string): Promise<ChannelCopies | null> {
  return db.transaction(async (tx) => {
    const post = await readPost(tx, postId);
    if (!post) return null;
    const postPosts = postAsCopyPosts([post, ...post.threadPosts]);
    const byChannel = new Map<string, PostCopyWithAssets[]>();
    for (const copy of await readPostCopies(tx, postId))
      byChannel.set(copy.channelId, [...(byChannel.get(copy.channelId) ?? []), copy]);
    const channelIds = (await readChannels(tx)).map((channel) => channel.channelId);

    const shown: Omit<ChannelCopy, 'channel'>[] = [];
    const addableIds: string[] = [];
    const card = (copy: PostCopyWithAssets) => {
      const follows = followsPost(copy);
      const { id, channelId, sentAt } = copy;
      return { id, postId, channelId, sentAt, posts: follows ? postPosts : copy.posts, followsPost: follows };
    };
    for (const channelId of channelIds) {
      const copies = byChannel.get(channelId) ?? [];
      byChannel.delete(channelId);
      const kept = copies.filter((copy) => copy.removedAt == null);
      if (copies.length === 0)
        shown.push({
          id: copyIdOf(postId, channelId),
          postId,
          channelId,
          sentAt: null,
          posts: postPosts,
          followsPost: true,
        });
      else if (kept.length === 0) addableIds.push(channelId);
      else shown.push(...kept.map(card));
    }
    for (const copies of byChannel.values())
      shown.push(...copies.filter((copy) => copy.removedAt == null && !followsPost(copy)).map(card));

    return {
      copies: shown.flatMap((copy) => {
        const channel = channelById(copy.channelId);
        return channel ? [{ ...copy, channel }] : [];
      }),
      addable: addableIds.flatMap((channelId) => channelById(channelId) ?? []),
      hasChannels: channelIds.length > 0,
    };
  });
}

/** One card of the post's (by its id, stored or fixed), or null when it has none. */
export async function readChannelCopy(db: SyncDb, postId: string, copyId: string): Promise<ChannelCopy | null> {
  return (await readChannelCopies(db, postId))?.copies.find((copy) => copy.id === copyId) ?? null;
}
