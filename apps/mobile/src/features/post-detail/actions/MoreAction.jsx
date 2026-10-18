import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

import MenuOption from '@/components/popup-menu-options/MenuOption';
import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import usePosts from '@/features/posts-context/usePosts';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function MoreAction({ post, afterDelete }) {
  const { deletePost } = usePosts();
  const navigation = useNavigation();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();

  // The post editor is pushed, not navigated to: opened inside the editor's sheet, navigate would hand
  // its params to that open editor instead of opening a new one.
  function handleEditPost() {
    navigation.push('AddEditPostModal', { postId: post.id });
  }

  function handleDeletePost() {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            await deletePost(post.id);
            if (afterDelete) afterDelete();
          },
        },
      ],
      { cancelable: true },
    );
  }

  function handleRepost() {
    navigation.push('AddEditPostModal', { rePostId: post.id });
  }

  async function handleDownloadAssets() {
    await saveAssetsToMediaLibraryAsync(post.postAssets.map((postAsset) => postAsset.asset));
  }

  return (
    <PopupMenu icon="menu" variant="pill">
      <MenuOption label="Download assets" icon="cloud-download" onPress={handleDownloadAssets} />
      <MenuOption label="Edit" icon="edit" onPress={handleEditPost} />
      <MenuOption label="Repost" icon="repeat" onPress={handleRepost} />
      <MenuOption label="Delete" icon="trash" onPress={handleDeletePost} danger isLast />
    </PopupMenu>
  );
}
