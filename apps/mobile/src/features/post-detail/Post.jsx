import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';

import ThreadPost from './ThreadPost';

import CopyTextButton from '@/components/CopyTextButton';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ThreadConnector from '@/components/ThreadConnector';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import PostRows from '@/features/post-list/PostRows';
import PostView from '@/features/posts/PostView';
import { layout } from '@/styles/designTokens';

const OTHER_POSTS_LIMIT = 30;

/**
 * A post and its thread: the post's card (PostView, with Copy), then each following post's card
 * joined by a short line, then Write with AI about the post, the albums of the thread's pictures and
 * the other posts from the thread's albums. `post` is a postQuery row read by id (with its
 * `threadPosts`).
 */
export default function Post({ post, contentPaddingTop = 0, contentPaddingBottom = 0 }) {
  const navigation = useNavigation();
  const sessionId = useSubjectChat({ kind: 'post', text: post.text, postAssets: post.postAssets });

  const assetIds = [post, ...post.threadPosts].flatMap((p) => p.postAssets.map((postAsset) => postAsset.asset.id));

  // Pushed, so back returns to the post. A picture opens with the others of its own post.
  function openAsset(postId, asset) {
    navigation.push('AssetScreen', { assetId: asset.id, query: { scope: { postId } } });
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
    >
      <PostView
        post={post}
        onPressAsset={(asset) => openAsset(post.id, asset)}
        meta={<CopyTextButton text={post.text} style={styles.copy} />}
      />

      {post.threadPosts.map((part) => (
        <View key={part.id}>
          <ThreadConnector />
          <ThreadPost post={part} onOpenAsset={(asset) => openAsset(part.id, asset)} />
        </View>
      ))}

      <WriteWithAi sessionId={sessionId} onOpenChat={(params) => navigation.navigate('PostChat', params)} />

      <View style={styles.related}>
        <ScreenSectionHeader title="Posted Albums" isFlush />
        <AssetAlbums assetIds={assetIds} emptyText="Not in an album" />

        <ScreenSectionHeader title="Other Posts" isFlush />
        <PostRows scope={{ sharesAlbumWithPostId: post.id }} emptyText="No other posts" limit={OTHER_POSTS_LIMIT} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
  copy: {
    marginLeft: 'auto',
  },
  related: {
    marginTop: 20,
  },
});
