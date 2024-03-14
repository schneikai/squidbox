import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

export default function MoreAction({ asset, navigation, onDeleteAsset }) {
  const { setPostsQuery } = useAppSettings();

  function handleAddToAlbum() {
    navigation.navigate('AddToAlbumModal', { assetIds: [asset.id] });
  }

  function handleCreatePost() {
    navigation.navigate('AddEditPostModal', { assetIds: [asset.id] });
  }

  function handleShowPosts() {
    setPostsQuery(`asset:${asset.id}`);
    navigation.navigate('PostsTab', { screen: 'PostsScreen' });
  }

  function handleDeleteAsset() {
    Alert.alert(
      `Delete ${humanizeMediaType(asset.mediaType)}`,
      `Are you sure you want to delete this ${humanizeMediaType(asset.mediaType)}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteAsset(asset);
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="ellipsis-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <TextMenuOption label="Add to album" onPress={handleAddToAlbum} />
        <TextMenuOption label="Create post" onPress={handleCreatePost} />
        <TextMenuOption label="Show posts" onPress={handleShowPosts} />
        <TextMenuOption
          label={`Delete ${asset && humanizeMediaType(asset.mediaType)}`}
          onPress={handleDeleteAsset}
          isLast
        />
      </MenuOptions>
    </Menu>
  );
}
