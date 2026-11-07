import { router } from 'expo-router';

import Divider from '@/components/Divider';
import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import type { PostListRow, PostWithAssets } from '@/features/post-list/postQuery';
import readPost from '@/features/post-list/readPost';
import usePosts from '@/features/posts-context/usePosts';
import { getDb } from '@/sync/db/client';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import confirmAsync from '@/utils/confirmAsync';

export type MoreActionProps = {
  post: Pick<PostListRow, 'id' | 'postAssets' | 'threadCount'> & { threadPosts?: Pick<PostWithAssets, 'postAssets'>[] };
  afterDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

// The post's menu: Download assets, Edit, Repost and Delete (all of a thread's posts; then
// `afterDelete`). Its ⋯ on the post screen, or `trigger` (MenuButton's): its card in a list of posts,
// on a long press. A list's post comes without its following posts: Download reads them then.
export default function MoreAction({ post, afterDelete, trigger }: MoreActionProps) {
  const { deletePost } = usePosts();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();

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

  async function handleDownloadAssets() {
    const threadPosts =
      post.threadPosts ?? (post.threadCount ? ((await readPost(getDb(), post.id))?.threadPosts ?? []) : []);
    await saveAssetsToMediaLibraryAsync(
      [post, ...threadPosts].flatMap((p) => p.postAssets.map((postAsset) => postAsset.asset)),
    );
  }

  return (
    <MenuButton accessibilityLabel="Post options" trigger={trigger}>
      <MenuOption label="Download assets" icon="cloud-download" onPress={handleDownloadAssets} />
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} colorPalette="danger" />
    </MenuButton>
  );
}
