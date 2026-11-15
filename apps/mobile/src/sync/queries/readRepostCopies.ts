import type { PostCopyRecord } from '@squidbox/shared';

import readPostCopies from './readPostCopies';

import type { SyncDb } from '@/sync/db/types';
import { isOwnCopy, isRemoved } from '@/sync/postCopiesRepository';

/** A copy a repost starts with: its channel and its posts. */
export type RepostCopy = Pick<PostCopyRecord, 'channelId' | 'posts'>;

/**
 * The copies a repost of `postId` starts with: the post's own copies the user didn't remove, sent or
 * not (the repost adds them unsent), in the order they were added. Its other channels get cards that
 * follow the repost.
 */
export default async function readRepostCopies(db: SyncDb, postId: string): Promise<RepostCopy[]> {
  return (await readPostCopies(db, postId))
    .filter((copy) => isOwnCopy(copy) && !isRemoved(copy))
    .map(({ channelId, posts }) => ({
      channelId,
      posts: posts.map(({ text, mentions, assetIds }) => ({ text, mentions, assetIds })),
    }));
}
