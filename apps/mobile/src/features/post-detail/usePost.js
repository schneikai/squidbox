import postQuery from '@/features/post-list/postQuery';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** One post, live, with its `postAssets`: `undefined` until read, `null` when it doesn't exist. */
export default function usePost(postId) {
  const query = postQuery({ scope: { postId } });
  return useLiveQuery(async (db) => (await query.read(db, { limit: 1 })).rows[0] ?? null, query.tables, [postId]);
}
