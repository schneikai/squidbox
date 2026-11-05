import preloadFilesAsync from './preloadFilesAsync';

import { getAssetThumbnailUri, hasThumbnailAsync } from '@/utils/assets/assetStorage';

const THUMBNAILS = { hasAsync: hasThumbnailAsync, uriOf: getAssetThumbnailUri };

// Downloads the thumbnails of `assets` not in `library` yet and resolves the names of those it has
// afterwards (preloadFilesAsync).
export default function preloadAssetThumbnailsAsync(assets, library, signal) {
  return preloadFilesAsync(
    assets.map((asset) => asset.thumbnailFilename),
    THUMBNAILS,
    library,
    signal,
  );
}
