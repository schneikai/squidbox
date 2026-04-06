import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

export default function MoreAction({ asset, navigation }) {
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

  async function handleCopyFileUrl() {
    try {
      const url = await getAssetFileDownloadUrlAsync(asset.filename, { expiresIn: 7 * 24 * 60 * 60 });
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'File URL copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Failed to get file URL.');
    }
  }

  function handleEditNotes() {
    navigation.navigate('EditNotesModal', { type: 'asset', id: asset.id, notes: asset.notes ?? '' });
  }

  return (
    <PopupMenu icon="menu" variant="pill">
      <MenuOption label="Add to album" icon="library" onPress={handleAddToAlbum} />
      <MenuOption label="Create post" icon="edit" onPress={handleCreatePost} />
      <MenuOption label="Show posts" icon="list" onPress={handleShowPosts} />
      <MenuOption label="Copy file URL" icon="link" onPress={handleCopyFileUrl} />
      <MenuOption
        label={asset.notes ? 'Edit note' : 'Add note'}
        icon="document"
        onPress={handleEditNotes}
        isLast
      />
    </PopupMenu>
  );
}
