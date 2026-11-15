import { router } from 'expo-router';

import deletePostConfirm from './deletePostConfirm';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useSheetRoute from '@/hooks/useSheetRoute';
import usePosts from '@/providers/posts/usePosts';
import { getDb } from '@/sync/db/client';
import type { PostListRow } from '@/sync/queries/postQuery';
import readPost from '@/sync/queries/readPost';
import { countPostCopies } from '@/sync/queries/readPostCopies';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import canShareFiles from '@/utils/files/canShareFiles';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount'>;
  beforeDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Share (where canShareFiles, when the post or its thread has photos), Send to channels (not inside a sheet, where it would open a sheet on a sheet),
// Edit, Repost and Delete (all of a thread's posts and its channel copies), after `beforeDelete` (leaving the screen first, so no screen
// is open on the post when it goes: none says "This post was deleted"). Its ⋯ on the post screen, or
// `trigger` (MenuButton's): its card in a list of posts, on a long press. Share reads a thread's
// following posts when tapped.
export default function MoreAction({ post, beforeDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const shareAssetsAsync = useShareAssets();
  const isInSheet = !!useSheetRoute();

  const hasAssets = post.postAssets.length > 0 || post.threadCount > 0;

  function handleEditPost() {
    router.navigate({ pathname: '/post-editor/[postId]', params: { postId: post.id } });
  }

  async function handleDeletePost() {
    const copyCount = await countPostCopies(getDb(), post.id);
    const confirmed = await confirmDeleteAsync(deletePostConfirm({ threadCount: post.threadCount, copyCount }));
    if (!confirmed) return;
    beforeDelete?.();
    await deletePost(post.id);
  }

  function handleSendToChannels() {
    router.navigate({ pathname: '/send-to-channels/[postId]', params: { postId: post.id } });
  }

  function handleRepost() {
    router.navigate({ pathname: '/post-editor', params: { rePostId: post.id } });
  }

  async function handleShare() {
    const threadPosts = post.threadCount ? ((await readPost(getDb(), post.id))?.threadPosts ?? []) : [];
    await shareAssetsAsync(
      [post, ...threadPosts].flatMap((part) => part.postAssets.map((postAsset) => postAsset.asset)),
    );
  }

  return (
    <MenuButton accessibilityLabel="Post options" trigger={trigger}>
      {canShareFiles && hasAssets && <MenuOption label="Share" icon="share" onPress={handleShare} />}
      {!isInSheet && <MenuOption label="Send to channels" icon="send" onPress={handleSendToChannels} />}
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} colorPalette="danger" />
    </MenuButton>
  );
}
