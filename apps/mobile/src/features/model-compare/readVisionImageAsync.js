import * as ImageManipulator from 'expo-image-manipulator';

import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';

const LONGER_SIDE = 512;

/**
 * A photo for the vision compare, `{ base64, mimeType }`: the asset's thumbnail (a video's is its
 * frame), 512 px on the longer side, as a JPEG. It works for photos not backed up yet; one whose
 * thumbnail is only in the cloud is fetched first through the thumbnail loader. Throws with why
 * when there's none to be had.
 */
export default async function readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated, signal }) {
  const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated, library, signal });
  if (status === 'remote') await loadThumbnailAsync(asset, loadThumbnail);
  else if (status !== 'local') throw new Error(assetFileUnavailableMessages[status].title);

  const resize = asset.width >= asset.height ? { width: LONGER_SIDE } : { height: LONGER_SIDE };
  const { base64 } = await ImageManipulator.manipulateAsync(
    getAssetThumbnailUri(asset.thumbnailFilename, library),
    [{ resize }],
    { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { base64, mimeType: 'image/jpeg' };
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
