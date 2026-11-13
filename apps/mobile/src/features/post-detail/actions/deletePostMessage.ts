import joinWords from '@/utils/joinWords';

/**
 * What Delete asks before deleting a post: about its channels when it is on more than one
 * (`channelNames`, in the order they show), else about its thread when it has following posts
 * (`threadCount`), else the plain question.
 */
export default function deletePostMessage({
  threadCount,
  channelNames,
}: {
  threadCount: number;
  channelNames: string[];
}): string {
  if (channelNames.length > 1) {
    return `This deletes the post on all its channels: ${joinWords(channelNames)}.`;
  }
  const count = 1 + threadCount;
  return count > 1 ? `This deletes all ${count} posts of the thread.` : 'Are you sure you want to delete this post?';
}
