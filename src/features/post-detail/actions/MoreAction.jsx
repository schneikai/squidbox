import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import ProgressModal from '@/components/ProgressModal';
import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import useAssets from '@/features/assets-context/useAssets';
import usePosts from '@/features/posts-context/usePosts';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';

export default function MoreAction({ post, afterDelete }) {
  const { deletePost } = usePosts();
  const { assets } = useAssets();
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: () => {
      setProgressVisible(true);
    },
    onProgress: (progress) => {
      setProgress(progress);
    },
    onFinish: () => {
      setProgressVisible(false);
      setProgress(0);
    },
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
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <Menu>
        <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
          <Ionicons name="ellipsis-vertical" style={headerActionStyles.buttonIcon} />
        </MenuTrigger>
        <MenuOptions customStyles={popupMenuStyles.menuOptions}>
          <TextMenuOption label="Download Assets" onPress={handleDownloadAssets} />
          <TextMenuOption label="Edit" onPress={handleEditPost} />
          <TextMenuOption label="Repost" onPress={handleRepost} />
          <TextMenuOption label="Delete" onPress={handleDeletePost} isLast />
        </MenuOptions>
      </Menu>
    </>
  );
}
