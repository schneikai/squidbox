import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import type { PostListRow, PostWithAssets } from './postQuery';
import threadCount from './threadCount';
import withPostAssets from './withPostAssets';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readThreadPosts } from '@/sync/postThreads';

const p = alias(schema.posts, 'p');

/** A post as the post screen and the editor read it: with its following posts in order, each with its assets. */
export type PostDetailRow = PostListRow & { threadPosts: PostWithAssets[] };

/**
 * One post with its `postAssets` and its following posts (`threadPosts`, in order, each with its
 * `postAssets`), or `null` when it doesn't exist: one transaction, one edge read for all of them.
 */
export default function readPost(db: SyncDb, postId: string): Promise<PostDetailRow | null> {
  return db.transaction(async (tx) => {
    const post = await readPostRow(tx, postId);
    if (!post) return null;
    const following = await readThreadPosts(tx, [postId]);
    const [first, ...threadPosts] = await withPostAssets(tx, [post, ...following]);
    // `first` is typed as either kind of post: the row's own fields come from `post`.
    return { ...post, postAssets: first.postAssets, threadPosts };
  });
}

// The live post, as a post list's row reads it (its following posts' `threadCount`), without its assets.
async function readPostRow(tx: SyncDb, postId: string) {
  const [post] = await tx
    .select({ ...getTableColumns(p), threadCount })
    .from(p)
    .where(and(isNull(p.deletedAt), eq(p.id, postId)));
  return post;
}
