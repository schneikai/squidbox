import type { AssetRecord, VisionImage } from '@squidbox/shared';

import type { CloudContextValue } from '@/features/cloud/CloudContext';
import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import type { AssetFileLocation } from '@/utils/assets/files/getAssetFileStatusAsync';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import visionImage from '@/utils/assets/visionImage';
import resizeToJpegAsync from '@/utils/thumbnails/resizeToJpegAsync';

// What a tagging (or the vision compare) reads of an asset.
export type VisionAsset = Pick<
  AssetRecord,
  'id' | 'filename' | 'thumbnailFilename' | 'mediaType' | 'isThumbnailSynced' | 'width' | 'height'
>;

export type VisionImageDeps = AssetFileLocation &
  Pick<CloudContextValue, 'preloadAssetThumbnailsAsync'> & { signal?: AbortSignal };

// The deps without a signal: what useVisionImageDeps gives a screen (a tagging, the vision compare).
export type VisionImageReadDeps = Omit<VisionImageDeps, 'signal'>;

/**
 * A photo for the assistant to look at (the vision compare, the photo tags), `{ base64, mimeType }`:
 * the asset's thumbnail (a video's is its frame) as the JPEG `visionImage` describes. It works for
 * photos not backed up yet; one whose thumbnail is only in the cloud is downloaded first
 * (`preloadAssetThumbnailsAsync` from useCloud), which stops when `signal` aborts. Throws with why
 * when there's none to be had.
 */
export default async function readVisionImageAsync(
  asset: VisionAsset,
  { library, isAuthenticated, preloadAssetThumbnailsAsync, signal }: VisionImageDeps,
): Promise<VisionImage> {
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
    longSide: visionImage.longSide,
    quality: visionImage.quality,
    base64: true,
  });
  // Asked for with `base64: true`, so the image has it.
  return { base64: base64!, mimeType: 'image/jpeg' };
}
