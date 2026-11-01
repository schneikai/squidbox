import { moveFile } from '@/library/fs';
import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import deletePath from '@/utils/files/deletePath';
import getFileExtension from '@/utils/files/getFileExtension';
import createThumbnail from '@/utils/thumbnails/createThumbnail';

// Create a thumbnail from the assets source file and save it to the device, into `library`'s
// thumbnails (the open library when none is given), under a new name or the asset's
// `thumbnailFilename` (one made again).
export default async function createAssetThumbnail(assetId, fileUri, mediaType, library, { thumbnailFilename } = {}) {
  const tempAssetThumbnailUri = await createThumbnail(fileUri, mediaType);
  const filename = thumbnailFilename ?? `${assetId}thumb.${getFileExtension(tempAssetThumbnailUri)}`;

  try {
    await moveFile(tempAssetThumbnailUri, getAssetThumbnailUri(filename, library));
  } catch (e) {
    try {
      deletePath(tempAssetThumbnailUri);
    } catch {
      // The temporary file is in the cache, which the OS clears.
    }
    throw e;
  }

  return filename;
}
