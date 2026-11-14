import type confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import joinWords from '@/utils/joinWords';

/**
 * What Delete asks before deleting a post (confirmDeleteAsync's options). A post with other versions
 * (`hasOtherVersions`) or on more than one channel (`channelNames`, each
 * once, in the order they show) goes on all of them, which it says, naming them when there is more
 * than one; else a thread says how many posts go (`threadCount`, its following posts); else just the
 * post.
 */
export default function deletePostConfirm({
  threadCount,
  hasOtherVersions,
  channelNames,
}: {
  threadCount: number;
  hasOtherVersions: boolean;
  channelNames: string[];
}): Parameters<typeof confirmDeleteAsync>[0] {
  if (hasOtherVersions || channelNames.length > 1) {
    const also =
      channelNames.length > 1
        ? `It goes on all its channels: ${joinWords(channelNames)}.`
        : 'It goes on all its channels.';
    return { name: 'this post', also };
  }
  const count = 1 + threadCount;
  return count > 1 ? { name: 'this thread', also: `All ${count} of its posts go.` } : { name: 'this post' };
}
