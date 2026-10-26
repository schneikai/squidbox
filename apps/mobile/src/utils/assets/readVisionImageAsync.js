import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import readFileAsBase64Async from '@/utils/files/readFileAsBase64Async';

/**
 * A photo for the assistant to look at (the vision compare, the photo tags), `{ base64, mimeType }`:
 * the asset's thumbnail as it is (a 1000 px JPEG; a video's is its frame). It works for photos not backed up yet; one whose thumbnail is
 * only in the cloud is downloaded first (`preloadAssetThumbnailsAsync` from useCloud), which stops
 * when `signal` aborts. Throws with why when there's none to be had.
 */
export default async function readVisionImageAsync(
  asset,
  { library, isAuthenticated, preloadAssetThumbnailsAsync, signal },
) {
  const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated, library, signal });
  if (status === 'remote') {
    const names = await preloadAssetThumbnailsAsync([asset], library, signal);
    if (!names.has(asset.thumbnailFilename)) throw new Error("Couldn't fetch the thumbnail");
  } else if (status !== 'local') {
    throw new Error(assetFileUnavailableMessages[status].title);
  }

  const base64 = await readFileAsBase64Async(getAssetThumbnailUri(asset.thumbnailFilename, library));
  return { base64, mimeType: 'image/jpeg' };
}
