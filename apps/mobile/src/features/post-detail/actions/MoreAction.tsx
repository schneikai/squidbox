import { router } from 'expo-router';

import deletePostConfirm from './deletePostConfirm';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import usePosts from '@/providers/posts/usePosts';
import { getDb } from '@/sync/db/client';
import type { PostListRow } from '@/sync/queries/postQuery';
import readPost from '@/sync/queries/readPost';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import canShareFiles from '@/utils/files/canShareFiles';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount'>;
  beforeDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Share (where canShareFiles, when the post or its thread has photos), Edit, Repost
// and Delete (all of a thread's posts), after `beforeDelete` (leaving the screen first, so no screen
// is open on the post when it goes: none says "This post was deleted"). Its ⋯ on the post screen, or
// `trigger` (MenuButton's): its card in a list of posts, on a long press. Share reads a thread's
// following posts when tapped.
export default function MoreAction({ post, beforeDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const shareAssetsAsync = useShareAssets();

  const hasAssets = post.postAssets.length > 0 || post.threadCount > 0;

  function handleEditPost() {
    router.navigate({ pathname: '/post-editor/[postId]', params: { postId: post.id } });
  }

  async function handleDeletePost() {
    const confirmed = await confirmDeleteAsync(deletePostConfirm({ threadCount: post.threadCount }));
    if (!confirmed) return;
    beforeDelete?.();
    await deletePost(post.id);
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
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} colorPalette="danger" />
    </MenuButton>
  );
}
