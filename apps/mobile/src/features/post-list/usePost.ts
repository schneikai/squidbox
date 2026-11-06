import postQuery from './postQuery';
import readPost from './readPost';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * One post, live, with its `postAssets` and its following posts (`threadPosts`): `undefined` until
 * read, `null` when it doesn't exist.
 */
export default function usePost(postId: string) {
  return useLiveQuery((db) => readPost(db, postId), postQuery({ scope: { postId } }).tables, [postId]);
}
