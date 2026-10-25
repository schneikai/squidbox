import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import readFileAsBase64Async from '@/utils/files/readFileAsBase64Async';

/**
 * A photo for the vision compare, `{ base64, mimeType }`: the asset's thumbnail as it is (a 1000 px
 * JPEG; a video's is its frame). It works for photos not backed up yet; one whose thumbnail is
 * only in the cloud is fetched first through the thumbnail loader. Throws with why when there's
 * none to be had.
 */
export default async function readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated }) {
  const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated, library });
  if (status === 'remote') await loadThumbnailAsync(asset, loadThumbnail);
  else if (status !== 'local') throw new Error(assetFileUnavailableMessages[status].title);

  const base64 = await readFileAsBase64Async(getAssetThumbnailUri(asset.thumbnailFilename, library));
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
