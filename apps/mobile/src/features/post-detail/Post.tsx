import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import ChannelBar from '@/features/channels/ChannelBar';
import useChannelOrder from '@/features/channels/useChannelOrder';
import useChannelSlide from '@/features/channels/useChannelSlide';
import useChannels from '@/features/channels/useChannels';
import TargetContactsSection from '@/features/contact-links/TargetContactsSection';
import PostThreadCards from '@/features/post-detail/PostThreadCards';
import PostRows from '@/features/post-list/PostRows';
import { layout } from '@/styles/designTokens';
import type { ChannelPostRow, PostDetailRow } from '@/sync/queries/readPost';

const OTHER_POSTS_LIMIT = 30;

type PostProps = {
  post: PostDetailRow;
  channelPost?: ChannelPostRow;
  onSelectChannel: (channelPostId: string | null) => void;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
};

/**
 * A post and its thread: the channel bar (ChannelBar) when the post has a channel or other channels,
 * then the card of the channel it shows (`channelPost`, else the post's own; PostView, a long press
 * copies a post's text) and each following post's card joined by a short line (PostThreadCards); a tap
 * on another channel's bubble calls `onSelectChannel` with its copy's id (null for the post's own).
 * Then, for the whole post (every channel), the contacts on it, the albums of its pictures, and the
 * other posts from those albums. `post` is a postQuery row read by id (with its `threadPosts` and
 * `channelPosts`).
 */
export default function Post({
  post,
  channelPost,
  onSelectChannel,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
}: PostProps) {
  const channels = useChannels();
  const channelOrder = useChannelOrder(channels);

  const parts = useMemo(
    () => [
      { key: post.id, channelId: post.channelId },
      ...post.channelPosts.map((copy) => ({ key: copy.id, channelId: copy.channelId })),
    ],
    [post.id, post.channelId, post.channelPosts],
  );
  const selectedKey = channelPost?.id ?? post.id;
  const slide = useChannelSlide(selectedKey, parts, channelOrder);
  // The pictures of the whole post: its thread's and its other channels' (with their threads) too.
  const assetIds = useMemo(() => {
    const all = [post, ...post.threadPosts, ...post.channelPosts.flatMap((each) => [each, ...each.threadPosts])];
    return [...new Set(all.flatMap((each) => each.postAssets.map(({ asset }) => asset.id)))];
  }, [post]);
  // Once the user's channels are read, so the bubbles never reorder after they show.
  const hasBar = !!channels && (!!post.channelId || post.channelPosts.length > 0);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
    >
      {hasBar && (
        <ChannelBar
          parts={parts}
          channelOrder={channelOrder}
          selectedKey={selectedKey}
          onSelect={(key) => onSelectChannel(key === post.id ? null : key)}
          style={styles.bar}
        />
      )}

      <Animated.View style={slide}>
        <PostThreadCards post={channelPost ?? post} />
      </Animated.View>

      {/* Contacts go on photos: a post without any has none. */}
      {assetIds.length > 0 && <TargetContactsSection of={{ postId: post.id }} isFlush />}

      <ScreenSectionHeader title="Posted Albums" isFlush />
      <AssetAlbums scope={{ assetIds }} emptyText="Not in an album" />

      <ScreenSectionHeader title="Other Posts" isFlush />
      <PostRows scope={{ sharesAlbumWithPostId: post.id }} emptyText="No other posts" limit={OTHER_POSTS_LIMIT} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
  bar: {
    marginBottom: layout.cardGap,
  },
});
