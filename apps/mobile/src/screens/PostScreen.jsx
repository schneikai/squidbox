import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import Post from '@/features/post-detail/Post';
import MoreAction from '@/features/post-detail/actions/MoreAction';
import usePost from '@/features/post-detail/usePost';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

export default function PostScreen({ route, navigation }) {
  const post = usePost(route.params.postId);
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  useCloseWhenGone(post, 'This post was deleted');

  if (!post) return null;

  const headerDate = post.postedAt ? formatDetailHeaderDate(post.postedAt) : { title: 'Not posted', subtitle: '' };

  return (
    <Page>
      <FloatingDetailHeader
        title={headerDate.title}
        subtitle={headerDate.subtitle}
        onBack={() => navigation.goBack()}
        menuSlot={<MoreAction post={post} afterDelete={() => navigation.goBack()} />}
      />

      <Post post={post} contentPaddingTop={paddingTop} contentPaddingBottom={paddingBottom} />
    </Page>
  );
}
