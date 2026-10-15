import postQuery from '@/features/post-list/postQuery';

/** One post with its `postAssets`, or `null` when it doesn't exist. */
export default async function readPost(db, postId) {
  const { rows } = await postQuery({ scope: { postId } }).read(db, { limit: 1, withCount: false });
  return rows[0] ?? null;
}
