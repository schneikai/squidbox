import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import useChannels from '@/features/channels/useChannels';
import TargetContactsSection from '@/features/contact-links/TargetContactsSection';
import toChatDraftPost from '@/features/post-chat/toChatDraftPost';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import PostThreadCards from '@/features/post-detail/PostThreadCards';
import IdeasTray from '@/features/post-ideas/IdeasTray';
import useIdeaSettings from '@/features/post-ideas/useIdeaSettings';
import PostRows from '@/features/post-list/PostRows';
import OtherChannels from '@/features/posts/OtherChannels';
import { layout, space } from '@/styles/designTokens';
import type { PostDetailRow } from '@/sync/queries/readPost';

const OTHER_POSTS_LIMIT = 30;

type PostProps = { post: PostDetailRow; contentPaddingTop?: number; contentPaddingBottom?: number };

/**
 * A post and its thread: the post's card (PostView, with its channel's label; a long press copies a post's text), then each following post's card
 * joined by a short line (PostThreadCards), then its Other channels (a row opens that channel's screen), then the contacts on it, the assistant's tray about the post and its thread
 * (IdeasTray, Repost ideas and the prompt buttons, written for the post; Copy, as nothing is edited here), the albums of the pictures of
 * the post, its thread and its other channels, and the other posts from those albums. `post` is a postQuery row read by id (with its
 * `threadPosts` and `channelPosts`).
 */
export default function Post({ post, contentPaddingTop = 0, contentPaddingBottom = 0 }: PostProps) {
  // The chat's posts: the post and its thread, each by its id.
  const posts = useMemo(() => [post, ...post.threadPosts].map((each) => toChatDraftPost(each.id, each)), [post]);
  const sessionId = useSubjectChat({ kind: 'post', posts, activeKey: post.id });
  const settings = useIdeaSettings();
  const channels = useChannels();
  const channelOrder = useMemo(() => (channels ?? []).map((channel) => channel.id), [channels]);

  const channelPosts = useMemo(
    () => post.channelPosts.map((channelPost) => ({ ...channelPost, key: channelPost.id })),
    [post.channelPosts],
  );
  // The pictures of the whole post: its thread's and its other channels' (with their threads) too.
  const parts = [post, ...post.threadPosts, ...post.channelPosts.flatMap((each) => [each, ...each.threadPosts])];
  const assetIds = [...new Set(parts.flatMap((each) => each.postAssets.map((postAsset) => postAsset.asset.id)))];

  // Pushed, so back returns to the post.
  function openChannel(channelPostId: string) {
    router.push(`/post-channel/${post.id}/${channelPostId}`);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
    >
      <PostThreadCards post={post} channelIds={post.channelId ? [post.channelId] : []} />

      <OtherChannels posts={channelPosts} channelOrder={channelOrder} onOpen={openChannel} />

      <IdeasTray sessionId={sessionId} target={post.id} ideas="repost" settings={settings} style={styles.tray} />

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
  tray: {
    marginTop: space.xxl,
  },
});
