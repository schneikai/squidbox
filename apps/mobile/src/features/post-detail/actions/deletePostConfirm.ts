import type confirmDeleteAsync from '@/utils/confirmDeleteAsync';

/**
 * What Delete asks before deleting a post (confirmDeleteAsync's options): a thread says how many
 * posts go (`threadCount`, its following posts); else just the post.
 */
export default function deletePostConfirm({
  threadCount,
}: {
  threadCount: number;
}): Parameters<typeof confirmDeleteAsync>[0] {
  const count = 1 + threadCount;
  return count > 1 ? { name: 'this thread', also: `All ${count} of its posts go.` } : { name: 'this post' };
}
