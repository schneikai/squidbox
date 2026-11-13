import { router } from 'expo-router';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import usePosts from '@/providers/posts/usePosts';
import { getDb } from '@/sync/db/client';
import type { PostListRow } from '@/sync/queries/postQuery';
import readPost from '@/sync/queries/readPost';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmAsync from '@/utils/confirmAsync';
import canShareFiles from '@/utils/files/canShareFiles';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount'>;
  afterDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Share (where canShareFiles, when the post or its thread has photos), Edit, Repost
// and Delete (all of a thread's posts; then `afterDelete`). Its ⋯ on the post screen, or `trigger`
// (MenuButton's): its card in a list of posts, on a long press. Share reads a thread's following
// posts when tapped.
export default function MoreAction({ post, afterDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const shareAssetsAsync = useShareAssets();

  const hasAssets = post.postAssets.length > 0 || post.threadCount > 0;

  function handleEditPost() {
    router.navigate(`/post-editor/${post.id}`);
  }

  async function handleDeletePost() {
    const count = 1 + post.threadCount;
    const message =
      count > 1 ? `This deletes all ${count} posts of the thread.` : 'Are you sure you want to delete this post?';
    if (!(await confirmAsync({ title: 'Delete Post', message, action: 'Delete', destructive: true }))) return;
    await deletePost(post.id);
    if (afterDelete) afterDelete();
  }

  function handleRepost() {
    router.navigate({ pathname: '/post-editor', params: { rePostId: post.id } });
  }

  async function handleShare() {
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
