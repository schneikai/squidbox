import { channelById } from '@squidbox/shared';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import PostThreadCards from '@/features/post-detail/PostThreadCards';
import MoreAction from '@/features/post-detail/actions/MoreAction';
import usePost from '@/features/post-list/usePost';
import useCloseWhen from '@/hooks/useCloseWhen';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

/**
 * Another channel of a post, from its Other channels: that channel's card with its label and its
 * thread (PostThreadCards), titled by the channel. Closes without a word once the post or that channel
 * of it is gone (removed in the editor; for a deleted post, the post's screen below says so once). Its
 * ⋯ is the post's menu (MoreAction): Share shares this channel's media, Delete leaves this screen and
 * the post's.
 */
export default function PostChannelScreen() {
  const navigation = useNavigation();
  const { postId, channelPostId } = useLocalSearchParams<{ postId: string; channelPostId: string }>();
  const post = usePost(postId);
  const channelPost = post?.channelPosts.find((each) => each.id === channelPostId);
  useCloseWhen(post === null || (post !== undefined && !channelPost));

  if (!post || !channelPost) return null;

  const title = channelById(channelPost.channelId)?.name ?? channelPost.channelId;
  const subtitle = post.postedAt ? formatDetailHeaderDate(post.postedAt).title : 'Not posted';

  return (
    <Page testID="post-channel-screen">
      <FloatingDetailHeader
        title={title}
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
        menuSlot={<MoreAction post={post} channelPost={channelPost} beforeDelete={() => router.dismiss(2)} />}
      />
      <DetailScrollView>
        <PostThreadCards post={channelPost} channelIds={[channelPost.channelId]} />
      </DetailScrollView>
    </Page>
  );
}
