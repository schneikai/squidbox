import { useLocalSearchParams, useNavigation } from 'expo-router';

import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import Post from '@/features/post-detail/Post';
import MoreAction, { type MoreActionProps } from '@/features/post-detail/actions/MoreAction';
import usePost from '@/features/post-list/usePost';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import type { PostRow } from '@/sync/db/schema';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

type PostScreenPost = MoreActionProps['post'] & Pick<PostRow, 'postedAt'>;

export default function PostScreen() {
  const navigation = useNavigation();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  // usePost is JS: the row typed by what this screen and its actions read.
  const post: PostScreenPost | null | undefined = usePost(postId);
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  useCloseWhenGone(post, 'This post was deleted');

  if (!post) return null;

  const headerDate = post.postedAt ? formatDetailHeaderDate(post.postedAt) : { title: 'Not posted', subtitle: '' };

  return (
    <Page testID="post-screen">
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
