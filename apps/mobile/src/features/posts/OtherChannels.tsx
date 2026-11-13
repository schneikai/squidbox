import ChannelPostRow, { type ChannelPostRowPost } from './ChannelPostRow';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import orderChannelIds from '@/features/channels/orderChannelIds';
import useChannels from '@/features/channels/useChannels';

type OtherChannelsProps = { posts: ChannelPostRowPost[]; onOpen: (key: string) => void };

/**
 * A post's Other channels: one row per other channel (ChannelPostRow; two on one channel are two
 * rows), in the user's channel order, then the catalog's; nothing without any. A row's tap opens it
 * by its key.
 */
export default function OtherChannels({ posts, onOpen }: OtherChannelsProps) {
  const channels = useChannels();
  if (posts.length === 0) return null;
  const ordered = orderChannelIds(
    posts,
    (post) => post.channelId,
    (channels ?? []).map((channel) => channel.id),
  );

  return (
    <>
      <ScreenSectionHeader title="Other channels" />
      {ordered.map((post) => (
        <ChannelPostRow key={post.key} post={post} onOpen={onOpen} />
      ))}
    </>
  );
}
