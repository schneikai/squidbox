import getAssetThumbnailUri from './getAssetThumbnailUri';

import { fileExists } from '@/library/fs';

export default async function hasThumbnailAsync(thumbnailFilename, library) {
  // ignore assets without thumbnailFilename
  if (!thumbnailFilename) return true;
  return fileExists(getAssetThumbnailUri(thumbnailFilename, library));
}
