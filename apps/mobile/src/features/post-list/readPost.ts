import postQuery, { type PostListRow, type PostWithAssets } from './postQuery';
import withPostAssets from './withPostAssets';

import type { SyncDb } from '@/sync/db/types';
import { readThreadPosts } from '@/sync/postThreads';

/** A post as the post screen and the editor read it: with its following posts in order, each with its assets. */
export type PostDetailRow = PostListRow & { threadPosts: PostWithAssets[] };

/**
 * One post with its `postAssets` and its following posts (`threadPosts`, in order, each with its
 * `postAssets`), or `null` when it doesn't exist: one transaction, one edge read for all of them.
 */
export default function readPost(db: SyncDb, postId: string): Promise<PostDetailRow | null> {
  return db.transaction(async (tx) => {
    const [post] = await postQuery({ scope: { postId } }).postsIn(tx, { limit: 1 });
    if (!post) return null;
    const following = await readThreadPosts(tx, [postId]);
    const [first, ...threadPosts] = await withPostAssets(tx, [post, ...following]);
    return { ...post, postAssets: first.postAssets, threadPosts };
  });
}
