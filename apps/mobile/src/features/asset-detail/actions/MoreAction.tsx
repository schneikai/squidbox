import { router } from 'expo-router';
import { Alert } from 'react-native';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useCopyText from '@/hooks/useCopyText';
import type { AssetRow } from '@/sync/db/schema';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

type MoreActionProps = {
  asset: Pick<AssetRow, 'id' | 'filename'>;
};
export default function MoreAction({ asset }: MoreActionProps) {
  const copyText = useCopyText();

  function handleAddToAlbum() {
    router.navigate({ pathname: '/add-to-album', params: { assetIds: asset.id } });
  }

  function handleCreatePost() {
    router.navigate({ pathname: '/post-editor', params: { assetIds: asset.id } });
  }

  async function handleCopyFileUrl() {
    try {
      const url = await getAssetFileDownloadUrlAsync(asset.filename, { expiresIn: 7 * 24 * 60 * 60 });
      await copyText(url);
      Alert.alert('Copied', 'File URL copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Failed to get file URL.');
    }
  }

  return (
    <MenuButton>
      <MenuOption label="Add to Album" icon="library" onPress={handleAddToAlbum} />
      <MenuOption label="Create post" icon="edit" onPress={handleCreatePost} />
      <MenuOption label="Copy file URL" icon="link" onPress={handleCopyFileUrl} />
    </MenuButton>
  );
}
