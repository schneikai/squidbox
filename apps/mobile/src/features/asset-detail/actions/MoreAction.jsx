import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

import MenuOption from '@/components/popup-menu-options/MenuOption';
import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

export default function MoreAction({ asset, navigation }) {
  function handleAddToAlbum() {
    navigation.navigate('AddToAlbumModal', { assetIds: [asset.id] });
  }

  // Pushed, not navigated to: opened inside the post editor's sheet, navigate would hand these params to
  // that open editor instead of opening a new one.
  function handleCreatePost() {
    navigation.push('AddEditPostModal', { assetIds: [asset.id] });
  }

  async function handleCopyFileUrl() {
    try {
      const url = await getAssetFileDownloadUrlAsync(asset.filename, { expiresIn: 7 * 24 * 60 * 60 });
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'File URL copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Failed to get file URL.');
    }
  }

  return (
    <PopupMenu icon="menu" variant="pill">
      <MenuOption label="Add to album" icon="library" onPress={handleAddToAlbum} />
      <MenuOption label="Create post" icon="edit" onPress={handleCreatePost} />
      <MenuOption label="Copy file URL" icon="link" onPress={handleCopyFileUrl} isLast />
    </PopupMenu>
  );
}
