import { useNavigation } from '@react-navigation/native';

import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import usePosts from '@/features/posts-context/usePosts';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import confirmAsync from '@/utils/confirmAsync';

export default function MoreAction({ post, afterDelete }) {
  const { deletePost } = usePosts();
  const navigation = useNavigation();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();

  function handleEditPost() {
    navigation.navigate('AddEditPostModal', { postId: post.id });
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
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  }

  async function handleDownloadAssets() {
    await saveAssetsToMediaLibraryAsync(post.postAssets.map((postAsset) => postAsset.asset));
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
