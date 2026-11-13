import postQuery from '@/sync/queries/postQuery';
import readPost from '@/sync/queries/readPost';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * One post, live, with its `postAssets`, its following posts (`threadPosts`) and, unless
 * `withChannels` is false (only its thread is shown), its other channels (`channelPosts`):
 * `undefined` until read, `null` when it doesn't exist.
 */
export default function usePost(postId: string, { withChannels = true }: { withChannels?: boolean } = {}) {
  return useLiveQuery((db) => readPost(db, postId, { withChannels }), postQuery({ scope: { postId } }).tables, [
    postId,
    withChannels,
  ]);
}
