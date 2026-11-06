import postQuery from './postQuery';
import readPost from './readPost';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * One post, live, with its `postAssets` and its following posts (`threadPosts`): `undefined` until
 * read, `null` when it doesn't exist.
 *
 * @returns {(import('./postQuery').PostListRow & { threadPosts: import('./postQuery').PostListRow[] }) | null | undefined}
 */
export default function usePost(postId) {
  return useLiveQuery((db) => readPost(db, postId), postQuery({ scope: { postId } }).tables, [postId]);
}
