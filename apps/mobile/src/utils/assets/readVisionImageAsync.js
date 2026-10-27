import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import resizeToJpegAsync from '@/utils/thumbnails/resizeToJpegAsync';

// The longer side of what the assistant looks at: models shrink larger images anyway, and price
// most by pixels, so a small JPEG costs less and keeps the request small.
const VISION_IMAGE_SIZE = 512;

/**
 * A photo for the assistant to look at (the vision compare, the photo tags), `{ base64, mimeType }`:
 * the asset's thumbnail (a video's is its frame) as a VISION_IMAGE_SIZE JPEG. It works for photos not
 * backed up yet; one whose thumbnail is only in the cloud is downloaded first
 * (`preloadAssetThumbnailsAsync` from useCloud), which stops when `signal` aborts. Throws with why
 * when there's none to be had.
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

  const { base64 } = await resizeToJpegAsync(getAssetThumbnailUri(asset.thumbnailFilename, library), {
    width: asset.width,
    height: asset.height,
    longSide: VISION_IMAGE_SIZE,
    base64: true,
  });
  return { base64, mimeType: 'image/jpeg' };
}
