import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import otherChannelIds from './otherChannelIds';
import type { PostListRow, PostWithAssets } from './postQuery';
import threadCount from './threadCount';
import withPostAssets from './withPostAssets';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readChannelPosts } from '@/sync/postChannels';
import { readThreadPosts } from '@/sync/postThreads';

const p = alias(schema.posts, 'p');

/** Another channel of a post, with its assets and its following posts in order, each with its assets. */
export type ChannelPostRow = PostWithAssets & { threadPosts: PostWithAssets[] };

/**
 * A post as the post screen and the editor read it: with its following posts in order and its other
 * channels (`channelPosts`, ChannelPostRow), each with its assets.
 */
export type PostDetailRow = PostListRow & { threadPosts: PostWithAssets[]; channelPosts: ChannelPostRow[] };

/**
 * One post with its `postAssets`, its following posts (`threadPosts`, in order) and its other channels
 * (`channelPosts`, with their following posts), each with its `postAssets`, or `null` when it doesn't
 * exist: one transaction, one edge read for all of them.
 */
export default function readPost(db: SyncDb, postId: string): Promise<PostDetailRow | null> {
  return db.transaction(async (tx) => {
    const post = await readPostRow(tx, postId);
    if (!post) return null;
    const following = await readThreadPosts(tx, [postId]);
    const copies = await readChannelPosts(tx, [postId]);
    const copyIds = copies.map((copy) => copy.id);
    const copiesFollowing = copyIds.length > 0 ? await readThreadPosts(tx, copyIds) : [];
    const [first, ...rest] = await withPostAssets(tx, [post, ...following, ...copies, ...copiesFollowing]);
    const threadPosts = rest.slice(0, following.length);
    const withAssets = rest.slice(following.length);
    const channelPosts = withAssets.slice(0, copies.length).map((copy) => ({
      ...copy,
      threadPosts: withAssets.slice(copies.length).filter((part) => part.threadRootId === copy.id),
    }));
    // `first` is typed as either kind of post: the row's own fields come from `post`.
    return { ...post, postAssets: first.postAssets, threadPosts, channelPosts };
  });
}

// The live post, as a post list's row reads it (`threadCount`, `otherChannelIds`), without its assets.
async function readPostRow(tx: SyncDb, postId: string) {
  const [post] = await tx
    .select({ ...getTableColumns(p), threadCount, otherChannelIds })
    .from(p)
    .where(and(isNull(p.deletedAt), eq(p.id, postId)));
  return post;
}
