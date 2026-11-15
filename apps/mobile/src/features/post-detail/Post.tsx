import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import ContactChipsSection from '@/features/contact-links/ContactChipsSection';
import PostThreadCards from '@/features/post-detail/PostThreadCards';
import PostRows from '@/features/post-list/PostRows';
import { layout } from '@/styles/designTokens';
import type { PostDetailRow } from '@/sync/queries/readPost';

const OTHER_POSTS_LIMIT = 30;

type PostProps = {
  post: PostDetailRow;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
};

/**
 * A post and its thread: the post's card (PostView, a long press copies a post's text) and each
 * following post's card joined by a short line (PostThreadCards). Then, when it has pictures, the
 * contacts on them, their albums, and the other posts from those albums. `post` is a postQuery row
 * read by id (with its `threadPosts`).
 */
export default function Post({ post, contentPaddingTop = 0, contentPaddingBottom = 0 }: PostProps) {
  // The pictures of the whole thread.
  const assetIds = useMemo(() => {
    const all = [post, ...post.threadPosts];
    return [...new Set(all.flatMap((each) => each.postAssets.map(({ asset }) => asset.id)))];
  }, [post]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
    >
      <PostThreadCards post={post} />

      {/* Contacts and albums go on photos: a post without any has none, and so no other posts from its
          albums either. */}
      {assetIds.length > 0 && (
        <>
          <ContactChipsSection scope={{ photoIds: assetIds }} isFlush />

          <ScreenSectionHeader title="Albums" isFlush />
          <AssetAlbums scope={{ assetIds }} emptyText="Not in an album" />

          <ScreenSectionHeader title="Other posts" isFlush />
          <PostRows scope={{ sharesAlbumWithPostId: post.id }} emptyText="No other posts" limit={OTHER_POSTS_LIMIT} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
  },
});
