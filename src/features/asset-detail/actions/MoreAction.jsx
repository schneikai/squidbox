import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

export default function MoreAction({ asset, navigation, onDeleteAsset }) {
  function addToAlbum() {
    navigation.navigate('AddToAlbumModal', { assetIds: [asset.id] });
  }

  function createPost() {
    navigation.navigate('AddEditPostModal', { assetIds: [asset.id] });
  }

  function deleteAsset() {
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
        <TextMenuOption label="Add to album" onPress={addToAlbum} />
        <TextMenuOption label="Create post" onPress={createPost} />
        <TextMenuOption label={`Delete ${asset && humanizeMediaType(asset.mediaType)}`} onPress={deleteAsset} isLast />
      </MenuOptions>
    </Menu>
  );
}
