import type { AssetRecord } from '@squidbox/shared';

import preloadFilesAsync from './preloadFilesAsync';

import type { LibraryPaths } from '@/library/libraryPaths';
import { getAssetThumbnailUri, hasThumbnailAsync } from '@/utils/assets/assetStorage';

const THUMBNAILS = { hasAsync: hasThumbnailAsync, uriOf: getAssetThumbnailUri };

// Downloads the thumbnails of `assets` not in `library` yet and resolves the names of those it has
// afterwards (preloadFilesAsync).
export default function preloadAssetThumbnailsAsync(
  assets: readonly Pick<AssetRecord, 'thumbnailFilename'>[],
  library: LibraryPaths,
  signal?: AbortSignal,
): Promise<Set<string>> {
  return preloadFilesAsync(
    assets.map((asset) => asset.thumbnailFilename),
    THUMBNAILS,
    library,
    signal,
  );
}
