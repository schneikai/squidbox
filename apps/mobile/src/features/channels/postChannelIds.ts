import orderChannelIds from './orderChannelIds';

import type { PostListRow } from '@/sync/queries/postQuery';

/**
 * The channel labels a post's card shows in a list, and Delete names: its first channel leading, then
 * its other channels and its other versions' in the user's channel order (orderChannelIds), each
 * channel once. None for a post without a channel and without other versions.
 */
export default function postChannelIds(
  post: Pick<PostListRow, 'channelIds' | 'otherChannelIds'>,
  channelOrder: string[],
): string[] {
  const [own, ...extras] = post.channelIds;
  const others = orderChannelIds([...extras, ...post.otherChannelIds], channelOrder);
  return [...new Set([...(own ? [own] : []), ...others])];
}
