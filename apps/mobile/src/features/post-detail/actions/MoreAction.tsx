import { channelName } from '@squidbox/shared';
import { router } from 'expo-router';

import deletePostConfirm from './deletePostConfirm';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import postChannelIds from '@/features/channels/postChannelIds';
import postAndThread from '@/features/post-detail/postAndThread';
import usePosts from '@/providers/posts/usePosts';
import { readChannelOrder } from '@/sync/channelsRepository';
import { getDb } from '@/sync/db/client';
import type { PostListRow } from '@/sync/queries/postQuery';
import readPost, { type PostWithThread } from '@/sync/queries/readPost';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import canShareFiles from '@/utils/files/canShareFiles';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount' | 'channelId' | 'otherChannelIds'>;
  channelPost?: PostWithThread;
  beforeDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Share (where canShareFiles, when what the screen shows has photos), Edit, Repost
// and Delete (all of a thread's posts and every channel's), after `beforeDelete` (leaving the screen
// first, so no screen is open on the post when it goes: none says "This post was deleted"). Its ⋯ on the
// post screen, with `channelPost` while that screen shows another channel of the post (Share shares its
// and its thread's media, Edit opens the editor on it), or `trigger` (MenuButton's): its card in a list
// of posts, on a long press. Share reads a thread's following posts when tapped.
export default function MoreAction({ post, channelPost, beforeDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const shareAssetsAsync = useShareAssets();

  const hasAssets = channelPost
    ? postAndThread(channelPost).some((each) => each.postAssets.length > 0)
    : post.postAssets.length > 0 || post.threadCount > 0;

  function handleEditPost() {
    router.navigate({
      pathname: '/post-editor/[postId]',
      params: { postId: post.id, ...(channelPost && { channelPostId: channelPost.id }) },
    });
  }

  async function handleDeletePost() {
    // Read at the tap: the menu sits on every card of a list, which shouldn't each read the channels.
    const channelOrder = await readChannelOrder(getDb());
    const channelNames = postChannelIds(post, channelOrder).map(channelName);
    const confirmed = await confirmDeleteAsync(
      deletePostConfirm({
        threadCount: post.threadCount,
        otherChannelCount: post.otherChannelIds.length,
        channelNames,
      }),
    );
    if (!confirmed) return;
    beforeDelete?.();
    await deletePost(post.id);
  }

  function handleRepost() {
    router.navigate({ pathname: '/post-editor', params: { rePostId: post.id } });
  }

  async function handleShare() {
    // What the screen shows: a channel's post with its thread, else the post with its (read now).
    const parts = channelPost
      ? postAndThread(channelPost)
      : [
          post,
          ...(post.threadCount ? ((await readPost(getDb(), post.id, { withChannels: false }))?.threadPosts ?? []) : []),
        ];
    await shareAssetsAsync(parts.flatMap((part) => part.postAssets.map((postAsset) => postAsset.asset)));
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
