import { channelById } from '@squidbox/shared';
import { router } from 'expo-router';

import deletePostMessage from './deletePostMessage';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import postChannelIds from '@/features/channels/postChannelIds';
import usePosts from '@/providers/posts/usePosts';
import { readChannels } from '@/sync/channelsRepository';
import { getDb } from '@/sync/db/client';
import type { PostListRow, PostWithAssets } from '@/sync/queries/postQuery';
import readPost from '@/sync/queries/readPost';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmAsync from '@/utils/confirmAsync';
import canShareFiles from '@/utils/files/canShareFiles';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount' | 'channelId' | 'otherChannelIds'>;
  channelPost?: PostWithAssets & { threadPosts: PostWithAssets[] };
  afterDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Share (where canShareFiles, when what the screen shows has photos), Edit, Repost
// and Delete (all of a thread's posts and every channel's; then `afterDelete`). Its ⋯ on the post screen
// and on one of its channels' screens (`channelPost`, what that screen shows: Share shares its and its
// thread's media), or `trigger` (MenuButton's): its card in a list of posts, on a long press. Share reads
// a thread's following posts when tapped.
export default function MoreAction({ post, channelPost, afterDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const shareAssetsAsync = useShareAssets();

  const hasAssets = channelPost
    ? [channelPost, ...channelPost.threadPosts].some((each) => each.postAssets.length > 0)
    : post.postAssets.length > 0 || post.threadCount > 0;

  function handleEditPost() {
    router.navigate(`/post-editor/${post.id}`);
  }

  async function handleDeletePost() {
    // Read at the tap: the menu sits on every card of a list, which shouldn't each read the channels.
    const channelOrder = (await readChannels(getDb())).map((row) => row.channelId);
    const channelNames = postChannelIds(post, channelOrder).map((id) => channelById(id)?.name ?? id);
    const message = deletePostMessage({ threadCount: post.threadCount, channelNames });
    if (!(await confirmAsync({ title: 'Delete Post', message, action: 'Delete', destructive: true }))) return;
    await deletePost(post.id);
    if (afterDelete) afterDelete();
  }

  function handleRepost() {
    router.navigate({ pathname: '/post-editor', params: { rePostId: post.id } });
  }

  async function handleShare() {
    if (channelPost) {
      await shareAssetsAsync(
        [channelPost, ...channelPost.threadPosts].flatMap((p) => p.postAssets.map((postAsset) => postAsset.asset)),
      );
      return;
    }
    const threadPosts = post.threadCount ? ((await readPost(getDb(), post.id))?.threadPosts ?? []) : [];
    await shareAssetsAsync([post, ...threadPosts].flatMap((p) => p.postAssets.map((postAsset) => postAsset.asset)));
  }

  return (
    <MenuButton accessibilityLabel="Post options" trigger={trigger}>
      {canShareFiles && hasAssets && <MenuOption label="Share" icon="share" onPress={handleShare} />}
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} colorPalette="danger" />
    </MenuButton>
  );
}
