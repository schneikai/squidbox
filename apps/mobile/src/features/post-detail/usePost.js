import readPost from '@/features/post-detail/readPost';
import postQuery from '@/features/post-list/postQuery';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** One post, live, with its `postAssets`: `undefined` until read, `null` when it doesn't exist. */
export default function usePost(postId) {
  return useLiveQuery((db) => readPost(db, postId), postQuery({ scope: { postId } }).tables, [postId]);
}
