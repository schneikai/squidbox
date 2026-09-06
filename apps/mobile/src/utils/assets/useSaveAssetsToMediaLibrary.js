import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

import useCloud from '@/features/cloud/useCloud';
import assetFileExistsAsync from '@/utils/assets/files/assetFileExistsAsync';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import copyToMediaLibraryAsync from '@/utils/media-library/copyToMediaLibraryAsync';

export default function useSaveAssetsToMediaLibrary({ onStart, onProgress, onFinish }) {
  const { isAuthenticated, downloadAssetFileAsync } = useCloud();

  async function saveAssetsToMediaLibraryAsync(assets) {
    if (await ensureCloudAccessAsync(assets)) return;

    const totalBytes = getAssetsTotalBytes(assets);
    let totalBytesCopied = 0;

    onStart();

    try {
      for (const asset of assets) {
        const startBytes = totalBytesCopied;
        await downloadAndCopyToMediaLibraryAsync(asset, (bytesCopied) => {
          totalBytesCopied = startBytes + bytesCopied;
          onProgress((totalBytesCopied / totalBytes) * 100);
        });
      }
    } finally {
      onFinish();
    }
  }

  async function ensureCloudAccessAsync(assets) {
    if (!isAuthenticated && (await hasAssetsThatRequireCloudToDownload(assets))) {
      Alert.alert(
        'Cloud Access Required',
        'Some files require cloud access to download. Please login to download these files.',
      );
      return true;
    }

    return false;
  }

  async function hasAssetsThatRequireCloudToDownload(assets) {
    for (const asset of assets) {
      if (await requiresCloudToDownloadAsync(asset)) {
        return true;
      }
    }

    return false;
  }

  async function requiresCloudToDownloadAsync(asset) {
    // A local copy only exists until the asset is fully synced to the cloud.
    // If it's still on the device we can save it without cloud access.
    return !(await assetFileExistsAsync(asset.filename));
  }

  function getAssetsTotalBytes(assets) {
    return assets.reduce((total, asset) => total + asset.fileSize, 0);
  }

  async function downloadAndCopyToMediaLibraryAsync(asset, onProgress) {
    if (await assetFileExistsAsync(asset.filename)) {
      // Not uploaded yet — copy the on-device file directly. Do not delete it,
      // it's the app's own asset file (still needed for uploading).
      await copyToMediaLibraryAsync(getAssetFileUri(asset.filename));
      onProgress(asset.fileSize);
      return;
    }

    const fileUri = await downloadAssetFileAsync(asset, onProgress);
    try {
      await copyToMediaLibraryAsync(fileUri);
    } finally {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  }

  return saveAssetsToMediaLibraryAsync;
}
