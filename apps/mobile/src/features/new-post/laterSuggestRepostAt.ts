import type { PostRow } from '@/sync/db/schema';

/**
 * When Later moves a post's repost suggestion to: a random whole millisecond between the post's
 * suggestion (now, for a post without one) and the newest suggestion (`newest`).
 */
export default function laterSuggestRepostAt(post: Pick<PostRow, 'suggestRepostAt'>, newest: number): number {
  const from = post.suggestRepostAt || Date.now();
  return Math.round(from + Math.random() * (newest - from)); // the server stores whole ms
}
