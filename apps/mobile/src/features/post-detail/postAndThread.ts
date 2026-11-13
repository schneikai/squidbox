/** A post and its following posts, in order, as one list. */
export default function postAndThread<P extends { threadPosts: readonly unknown[] }>(
  post: P,
): (P | P['threadPosts'][number])[] {
  return [post, ...post.threadPosts];
}
