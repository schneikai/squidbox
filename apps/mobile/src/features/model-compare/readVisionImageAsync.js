import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import resizeToThumbnail from '@/utils/thumbnails/resizeToThumbnail';

const LONGER_SIDE = 512;

/**
 * A photo for the vision compare, `{ base64, mimeType }`: the asset's thumbnail (a video's is its
 * frame), 512 px on the longer side, as a JPEG. It works for photos not backed up yet; one whose
 * thumbnail is only in the cloud is fetched first through the thumbnail loader. Throws with why
 * when there's none to be had.
 */
export default async function readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated }) {
  const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated, library });
  if (status === 'remote') await loadThumbnailAsync(asset, loadThumbnail);
  else if (status !== 'local') throw new Error(assetFileUnavailableMessages[status].title);

  const uri = getAssetThumbnailUri(asset.thumbnailFilename, library);
  const resized = await resizeToThumbnail(uri, asset.width, asset.height, { size: LONGER_SIDE, base64: true });
  // Only the base64 is sent: the JPEG the resize wrote to the cache goes (the web keeps no file).
  if (Platform.OS !== 'web') await FileSystem.deleteAsync(resized.uri, { idempotent: true });
  return { base64: resized.base64, mimeType: 'image/jpeg' };
}

function loadThumbnailAsync(asset, loadThumbnail) {
  return new Promise((resolve, reject) => {
    const withdraw = loadThumbnail(asset, (result) => {
      withdraw?.();
      if (result === 'done') resolve();
      else reject(new Error("Couldn't fetch the thumbnail"));
    });
  });
}
