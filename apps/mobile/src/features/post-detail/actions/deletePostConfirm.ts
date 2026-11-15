import type confirmDeleteAsync from '@/utils/confirmDeleteAsync';

/**
 * What Delete asks before deleting a post (confirmDeleteAsync's options): a thread says how many
 * posts go (`threadCount`, its following posts), and a post with channel copies (`copyCount`) that
 * they go too; else just the post.
 */
export default function deletePostConfirm({
  threadCount,
  copyCount,
}: {
  threadCount: number;
  copyCount: number;
}): Parameters<typeof confirmDeleteAsync>[0] {
  const count = 1 + threadCount;
  const also = [count > 1 && `All ${count} of its posts go.`, copyCount > 0 && 'Its channel copies go too.']
    .filter(Boolean)
    .join(' ');
  const name = count > 1 ? 'this thread' : 'this post';
  return also ? { name, also } : { name };
}
