import orderPostChannels from './orderPostChannels';

import type { PostListRow } from '@/sync/queries/postQuery';

/**
 * The channel labels a post's card shows in a list: its own channel first, then its other channels in
 * the user's channel order (orderPostChannels), each channel once. None for a post without a channel
 * and without other channels.
 */
export default function postChannelIds(
  post: Pick<PostListRow, 'channelId' | 'otherChannelIds'>,
  channelOrder: string[],
): string[] {
  const ordered = orderPostChannels([post.channelId, ...post.otherChannelIds], (id) => id, channelOrder);
  return [...new Set(ordered.flatMap((id) => (id ? [id] : [])))];
}
