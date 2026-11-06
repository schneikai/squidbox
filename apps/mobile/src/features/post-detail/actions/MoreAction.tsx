import { router } from 'expo-router';

import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import usePosts from '@/features/posts-context/usePosts';
import type { PostRow } from '@/sync/db/schema';
import type { AssetFileAsset } from '@/utils/assets/files/getAssetFileStatusAsync';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import confirmAsync from '@/utils/confirmAsync';

export type MoreActionProps = {
  post: Pick<PostRow, 'id'> & {
    postAssets: { asset: AssetFileAsset }[];
    threadPosts: { postAssets: { asset: AssetFileAsset }[] }[];
  };
  afterDelete?: () => void;
};

// The post's ⋯ menu: Download assets, Edit, Repost and Delete (all of a thread's posts; then
// `afterDelete`).
export default function MoreAction({ post, afterDelete }: MoreActionProps) {
  const { deletePost } = usePosts();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();

  function handleEditPost() {
    router.navigate(`/post-editor/${post.id}`);
  }

  async function handleDeletePost() {
    const count = 1 + post.threadPosts.length;
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
    await saveAssetsToMediaLibraryAsync(
      [post, ...post.threadPosts].flatMap((p) => p.postAssets.map((postAsset) => postAsset.asset)),
    );
  }

  return (
    <MenuButton>
      <MenuOption label="Download assets" icon="cloud-download" onPress={handleDownloadAssets} />
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} colorPalette="danger" />
    </MenuButton>
  );
}
