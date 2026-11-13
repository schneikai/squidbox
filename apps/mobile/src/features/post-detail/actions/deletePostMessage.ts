import joinWords from '@/utils/joinWords';

/**
 * What Delete asks before deleting a post. A post with other channels (`otherChannelCount`, its other
 * channels' posts) is deleted on all of them, which it says, naming them when it is on more than one
 * (`channelNames`, each once, in the order they show); else it counts its thread's posts when it has
 * following posts (`threadCount`); else the plain question.
 */
export default function deletePostMessage({
  threadCount,
  otherChannelCount,
  channelNames,
}: {
  threadCount: number;
  otherChannelCount: number;
  channelNames: string[];
}): string {
  if (otherChannelCount > 0) {
    return channelNames.length > 1
      ? `This deletes the post on all its channels: ${joinWords(channelNames)}.`
      : 'This deletes the post on all its channels.';
  }
  const count = 1 + threadCount;
  return count > 1 ? `This deletes all ${count} posts of the thread.` : 'Are you sure you want to delete this post?';
}
