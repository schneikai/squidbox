import type { AssetRecord } from '@squidbox/shared';

import { moveFile } from '@/library/fs';
import type { LibraryPaths } from '@/library/libraryPaths';
import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import deletePath from '@/utils/files/deletePath';
import getFileExtension from '@/utils/files/getFileExtension';
import createThumbnail from '@/utils/thumbnails/createThumbnail';

// Create a thumbnail from the assets source file and save it to the device, into `library`'s
// thumbnails (the open library when none is given), under a new name or the asset's
// `thumbnailFilename` (one made again, which replaces a copy that arrived meanwhile, say downloaded).
export default async function createAssetThumbnail(
  assetId: string,
  fileUri: string,
  mediaType: AssetRecord['mediaType'],
  library: LibraryPaths,
  { thumbnailFilename }: { thumbnailFilename?: string } = {},
): Promise<string> {
  const tempAssetThumbnailUri = await createThumbnail(fileUri, mediaType);
  const filename = thumbnailFilename ?? `${assetId}thumb.${getFileExtension(tempAssetThumbnailUri)}`;

  try {
    await moveFile(tempAssetThumbnailUri, getAssetThumbnailUri(filename, library), { overwrite: true });
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
