import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAssets from '@/features/assets-context/useAssets';
import usePosts from '@/features/posts-context/usePosts';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';

export default function MoreAction({ post, afterDelete }) {
  const { deletePost } = usePosts();
  const { assets } = useAssets();
  const navigation = useNavigation();
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  function handleEditPost() {
    navigation.navigate('AddEditPostModal', { postId: post.id });
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
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  }

  async function handleDownloadAssets() {
    const postAssets = assetRefsToPostAssets(post.assetRefs, assets);
    await saveAssetsToMediaLibraryAsync(postAssets.map((postAsset) => postAsset.asset));
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
