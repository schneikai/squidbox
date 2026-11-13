import { memo } from 'react';

import ChannelPostRow, { type ChannelPostRowPost } from './ChannelPostRow';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import orderChannelIds from '@/features/channels/orderChannelIds';

type OtherChannelsProps = { posts: ChannelPostRowPost[]; channelOrder: string[]; onOpen: (key: string) => void };

/**
 * A post's Other channels: one row per other channel (ChannelPostRow; two on one channel are two
 * rows), in the user's channel order (`channelOrder`), then the catalog's; nothing without any. A row's
 * tap opens it by its key. Memoized: it re-renders only when its rows or the order change.
 */
function OtherChannels({ posts, channelOrder, onOpen }: OtherChannelsProps) {
  if (posts.length === 0) return null;
  const ordered = orderChannelIds(posts, (post) => post.channelId, channelOrder);

  return (
    <>
      <ScreenSectionHeader title="Other channels" />
      {ordered.map((post) => (
        <ChannelPostRow key={post.key} post={post} onOpen={onOpen} />
      ))}
    </>
  );
}

export default memo(OtherChannels);
