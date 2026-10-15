import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

import useCloud from '@/features/cloud/useCloud';
import { getLibrary } from '@/library/current';
import assetFileExistsAsync from '@/utils/assets/files/assetFileExistsAsync';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import copyToMediaLibraryAsync from '@/utils/media-library/copyToMediaLibraryAsync';

export default function useSaveAssetsToMediaLibrary({ onStart, onProgress, onFinish }) {
  const { isAuthenticated, downloadAssetFileAsync } = useCloud();

  async function saveAssetsToMediaLibraryAsync(assets) {
    // The local copies are read from the library open now, however long the downloads take.
    const library = getLibrary();
    if (await ensureCloudAccessAsync(assets, library)) return;

    const totalBytes = getAssetsTotalBytes(assets);
    let totalBytesCopied = 0;

    onStart();

    try {
      for (const asset of assets) {
        const startBytes = totalBytesCopied;
        await downloadAndCopyToMediaLibraryAsync(asset, library, (bytesCopied) => {
          totalBytesCopied = startBytes + bytesCopied;
          onProgress((totalBytesCopied / totalBytes) * 100);
        });
      }
    } finally {
      onFinish();
    }
  }

  async function ensureCloudAccessAsync(assets, library) {
    if (!isAuthenticated && (await hasAssetsThatRequireCloudToDownload(assets, library))) {
      Alert.alert(
        'Cloud Access Required',
        'Some files require cloud access to download. Please login to download these files.',
      );
      return true;
    }

    return false;
  }

  async function hasAssetsThatRequireCloudToDownload(assets, library) {
    for (const asset of assets) {
      if (await requiresCloudToDownloadAsync(asset, library)) {
        return true;
      }
    }

    return false;
  }

  async function requiresCloudToDownloadAsync(asset, library) {
    // A local copy only exists until the asset is fully synced to the cloud.
    // If it's still on the device we can save it without cloud access.
    return !(await assetFileExistsAsync(asset.filename, library));
  }

  function getAssetsTotalBytes(assets) {
    return assets.reduce((total, asset) => total + asset.fileSize, 0);
  }

  async function downloadAndCopyToMediaLibraryAsync(asset, library, onProgress) {
    if (await assetFileExistsAsync(asset.filename, library)) {
      // Not uploaded yet — copy the on-device file directly. Do not delete it,
      // it's the app's own asset file (still needed for uploading).
      await copyToMediaLibraryAsync(getAssetFileUri(asset.filename, library));
      onProgress(asset.fileSize);
      return;
    }

    const fileUri = await downloadAssetFileAsync(asset, library, onProgress);
    try {
      await copyToMediaLibraryAsync(fileUri);
    } finally {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  }

  return saveAssetsToMediaLibraryAsync;
}
