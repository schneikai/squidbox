import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ThreadParts from '@/components/ThreadParts';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import assetHref from '@/features/asset-list/assetHref';
import ContactChipsSection from '@/features/contact-links/ContactChipsSection';
import PostRows from '@/features/post-list/PostRows';
import PostView from '@/features/posts/PostView';
import ThreadPost from '@/features/posts/ThreadPost';
import { layout } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';
import type { PostDetailRow } from '@/sync/queries/readPost';

const OTHER_POSTS_LIMIT = 30;

type PostProps = { post: PostDetailRow; contentPaddingTop?: number; contentPaddingBottom?: number };

/**
 * A post and its thread: the post's card (PostView; a long press copies a post's text), then each following post's card
 * joined by a short line, then the contacts on it, the albums of the thread's pictures and
 * the other posts from the thread's albums. `post` is a postQuery row read by id (with its
 * `threadPosts`).
 */
export default function Post({ post, contentPaddingTop = 0, contentPaddingBottom = 0 }: PostProps) {
  const assetIds = useMemo(
    () => [post, ...post.threadPosts].flatMap((each) => each.postAssets.map(({ asset }) => asset.id)),
    [post],
  );

  // Pushed, so back returns to the post. A picture opens with the others of its own post.
  function openAsset(postId: string, asset: Pick<AssetRow, 'id'>) {
    router.push(assetHref(asset.id, { scope: { postId } }));
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
    >
      <PostView post={post} onPressAsset={(asset) => openAsset(post.id, asset)} isTextSelectable />

      <ThreadParts
        parts={post.threadPosts}
        renderPart={(part) => (
          <ThreadPost post={part} onOpenAsset={(asset) => openAsset(part.id, asset)} isTextSelectable />
        )}
      />

      {/* Contacts go on photos: a post shows who is on its photos, and one without any reads none. */}
      {assetIds.length > 0 && <ContactChipsSection scope={{ photosOf: { postId: post.id } }} isFlush />}

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
});
