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
import versionChannelIds from '@/sync/versionChannelIds';

const p = alias(schema.posts, 'p');

/** A post with its assets and its following posts in order, each with its assets. */
export type PostWithThread = PostWithAssets & { threadPosts: PostWithAssets[] };

/** A version's channels as the read rule gives them (versionChannelIds), in place of the stored fields. */
type WithChannelIds<T> = Omit<T, 'channelId' | 'extraChannelIds'> & { channelIds: string[] };

/** Another version of a post (PostWithThread). It always has a channel (`channelIds` isn't empty). */
export type ChannelPostRow = WithChannelIds<PostWithThread>;

/**
 * A post as the post screen and the editor read it: with its channels (`channelIds`, empty for none),
 * its following posts in order and its other versions (`channelPosts`, ChannelPostRow), each with its
 * assets.
 */
export type PostDetailRow = WithChannelIds<PostListRow> &
  Pick<PostWithThread, 'threadPosts'> & { channelPosts: ChannelPostRow[] };

/**
 * One post with its `postAssets`, its following posts (`threadPosts`, in order) and its other versions
 * (`channelPosts`, with their following posts), each with its `postAssets` and `channelIds`, or `null`
 * when it doesn't exist: one transaction, one edge read for all of them. Without `withChannels` (a
 * caller that shows only the thread) the other versions aren't read and `channelPosts` is empty; the
 * post's own `channelIds` still leave out a channel another version holds.
 */
export default function readPost(
  db: SyncDb,
  postId: string,
  { withChannels = true }: { withChannels?: boolean } = {},
): Promise<PostDetailRow | null> {
  return db.transaction(async (tx) => {
    const post = await readPostRow(tx, postId);
    if (!post) return null;
    const following = await readThreadPosts(tx, [postId]);
    const copies = withChannels ? await readChannelPosts(tx, [postId]) : [];
    // Without the other versions, their rows still go to the read rule when the post has extras of its
    // own, which can lose to their channels.
    const otherVersions = withChannels || !post.extraChannelIds ? copies : await readChannelPosts(tx, [postId]);
    const copyIds = copies.map((copy) => copy.id);
    const copiesFollowing = copyIds.length > 0 ? await readThreadPosts(tx, copyIds) : [];
    const [first, ...rest] = await withPostAssets(tx, [post, ...following, ...copies, ...copiesFollowing]);
    // Each thread's following posts by their first post's id, in the order read.
    const threads = new Map<string, PostWithAssets[]>();
    for (const part of rest) {
      if (!part.threadRootId) continue;
      const thread = threads.get(part.threadRootId);
      if (thread) thread.push(part);
      else threads.set(part.threadRootId, [part]);
    }
    // A copy is always written with its channel; one without (no build writes it) isn't listed.
    const listed = otherVersions.filter((copy) => copy.channelId !== null);
    const [ownChannelIds, ...copyChannelIds] = versionChannelIds([post, ...listed]);
    const channelIdsById = new Map(
      copies.filter((copy) => copy.channelId !== null).map((copy, index) => [copy.id, copyChannelIds[index]]),
    );
    const channelPosts = rest
      .filter((part) => part.channelRootId === postId)
      .flatMap(({ channelId: _channelId, extraChannelIds: _extras, ...copy }) => {
        const channelIds = channelIdsById.get(copy.id);
        return channelIds ? [{ ...copy, channelIds, threadPosts: threads.get(copy.id) ?? [] }] : [];
      });
    const threadPosts = threads.get(postId) ?? [];
    const { channelId: _channelId, extraChannelIds: _extras, ...row } = post;
    // `first` is typed as either kind of post: the row's own fields come from `post`.
    return { ...row, channelIds: ownChannelIds, postAssets: first.postAssets, threadPosts, channelPosts };
  });
}

// The live post, as a post list's row reads it (`threadCount`, `otherChannelIds`), without its assets
// (its `channelIds` come from the read rule over all its versions).
async function readPostRow(tx: SyncDb, postId: string) {
  const [post] = await tx
    .select({ ...getTableColumns(p), threadCount, otherChannelIds })
    .from(p)
    .where(and(isNull(p.deletedAt), eq(p.id, postId)));
  return post;
}
