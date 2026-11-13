import { channelById } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import PostRowCard from './PostRowCard';

import type { CoverImageProps } from '@/components/CoverImage';
import Text from '@/components/Text';
import ChannelLabel from '@/features/channels/ChannelLabel';
import { space } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';

/** Another channel of a post, as its row shows it. */
export type ChannelPostRowPost = {
  key: string;
  channelId: string;
  text: string;
  postAssets: readonly { asset: NonNullable<CoverImageProps['asset']> & { duration: number | null } }[];
};

type ChannelPostRowProps = { post: ChannelPostRowPost; onOpen: (key: string) => void };

/**
 * A row of a post's Other channels: its first media as the tile (a video's length on it, else "+N" for
 * more), the channel's logo and name small over two lines of its text, and a chevron; a tap opens it.
 */
export default function ChannelPostRow({ post, onOpen }: ChannelPostRowProps) {
  const [first, ...rest] = post.postAssets;
  const duration = first?.asset.duration ? formatVideoDuration(first.asset.duration) : undefined;
  const name = channelById(post.channelId)?.name ?? post.channelId;

  return (
    <PostRowCard
      asset={first?.asset}
      moreCount={rest.length}
      badge={duration}
      onPress={() => onOpen(post.key)}
      accessibilityLabel={name}
    >
      <View style={styles.labels}>
        <ChannelLabel channelId={post.channelId} size="small" />
        <Text variant="reading" numberOfLines={2}>
          {post.text}
        </Text>
      </View>
    </PostRowCard>
  );
}

const styles = StyleSheet.create({
  labels: {
    gap: space.xs,
  },
});
