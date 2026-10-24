import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import useScreenPadding from '@/hooks/useScreenPadding';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

// Every post that shares an album with the post, in the order the post screen's capped Other Posts
// shows its first ones (postQuery's default, newest first).
export default function OtherPostsScreen({ route, navigation }) {
  const { postId } = route.params;
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { rows, count, loadMore } = usePagedQuery(postQuery({ scope: { sharesAlbumWithPostId: postId } }), 20);

  return (
    <Page>
      <FloatingDetailHeader
        title="Other Posts"
        subtitle={count === undefined ? undefined : pluralizeText('1 Post', '%{count} Posts', count)}
        onBack={() => navigation.goBack()}
      />

      {count === 0 ? (
        <EmptyState icon="share-alt" title="No other posts" style={{ flex: 1, paddingTop }} />
      ) : (
        <PostList rows={rows} loadMore={loadMore} contentContainerStyle={{ paddingTop, paddingBottom }} />
      )}
    </Page>
  );
}
