import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

import useCloud from '@/features/cloud/useCloud';
import { getLibrary } from '@/library/current';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetFileSourceAsync from '@/utils/assets/files/getAssetFileSourceAsync';
import getAssetFileStatusAsync from '@/utils/assets/files/getAssetFileStatusAsync';
import copyToMediaLibraryAsync from '@/utils/media-library/copyToMediaLibraryAsync';

export default function useSaveAssetsToMediaLibrary({ onStart, onProgress, onFinish }) {
  const { isAuthenticated, downloadAssetFileAsync } = useCloud();

  async function saveAssetsToMediaLibraryAsync(assets) {
    // The local copies are read from the library open now, however long the downloads take.
    const library = getLibrary();
    if (await alertIfUnavailableAsync(assets, library)) return;

    const totalBytes = getAssetsTotalBytes(assets);
    let totalBytesCopied = 0;

    onStart();

    try {
      for (const asset of assets) {
        const startBytes = totalBytesCopied;
        await copyAssetToMediaLibraryAsync(asset, library, (bytesCopied) => {
          totalBytesCopied = startBytes + bytesCopied;
          onProgress((totalBytesCopied / totalBytes) * 100);
        });
      }
    } finally {
      onFinish();
    }
  }

  // Checked up front, without asking the cloud for URLs, so a batch doesn't stop halfway.
  async function alertIfUnavailableAsync(assets, library) {
    for (const asset of assets) {
      const status = await getAssetFileStatusAsync(asset, { isAuthenticated, library });
      const unavailable = assetFileUnavailableMessages[status];
      if (unavailable) {
        Alert.alert(unavailable.title, unavailable.message);
        return true;
      }
    }
    return false;
  }

  function getAssetsTotalBytes(assets) {
    return assets.reduce((total, asset) => total + asset.fileSize, 0);
  }

  // Resolved right before the copy: the backup may have replaced the local copy by the cloud's since
  // the check, and a URL fetched now hasn't expired.
  async function copyAssetToMediaLibraryAsync(asset, library, onProgress) {
    const source = await getAssetFileSourceAsync(asset, { isAuthenticated, library });
    if (source.status) throw new Error(`${asset.filename} is ${source.status}`);

    if (!source.isRemote) {
      // Not uploaded yet — copy the on-device file directly. Do not delete it,
      // it's the app's own asset file (still needed for uploading).
      await copyToMediaLibraryAsync(source.uri);
      onProgress(asset.fileSize);
      return;
    }

    const fileUri = await downloadAssetFileAsync(asset, source.uri, library, onProgress);
    try {
      await copyToMediaLibraryAsync(fileUri);
    } finally {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  }

  return saveAssetsToMediaLibraryAsync;
}
