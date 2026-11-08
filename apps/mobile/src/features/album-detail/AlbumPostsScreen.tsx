import { useLocalSearchParams, useNavigation } from 'expo-router';

import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useAlbum from '@/features/album-detail/useAlbum';
import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import { usePagedQuery } from '@/sync/usePagedQuery';

// An album's posts, newest first, pushed from the posts chip at its top (AlbumHeader).
export default function AlbumPostsScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const album = useAlbum(albumId);
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { rows, loadMore } = usePagedQuery(postQuery({ scope: { albumId }, sort: 'postedAt:desc' }), 20);
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Posts" subtitle={album.name} onBack={() => navigation.goBack()} />
      <PostList rows={rows} loadMore={loadMore} contentContainerStyle={{ paddingTop, paddingBottom }} />
    </Page>
  );
}
