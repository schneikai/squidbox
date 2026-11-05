import ensureAssetThumbnailAsync, { type ThumbnailAsset } from './ensureAssetThumbnailAsync';

import { hasThumbnailAsync } from '@/utils/assets/assetStorage';
import type { AssetFileLocation, AssetFileStatus } from '@/utils/assets/files/getAssetFileStatusAsync';

let hasWarned = false;

// Where an asset's thumbnail can be had, like getAssetFileStatusAsync: 'local' (on this device, made
// again from the original if need be; on web, already fetched), 'remote' (the cloud copy), or why it
// can't: 'notUploaded' (its device hasn't backed it up yet) or 'signedOut'. Aborting `signal` (the
// tile left) skips a thumbnail still waiting to be made.
export default async function getAssetThumbnailStatusAsync(
  asset: ThumbnailAsset & { isThumbnailSynced: boolean },
  { isAuthenticated, library, signal }: AssetFileLocation & { signal?: AbortSignal },
): Promise<AssetFileStatus> {
  if (await hasThumbnailAsync(asset.thumbnailFilename, library)) return 'local';
  if (!asset.isThumbnailSynced) {
    const isMade = await ensureAssetThumbnailAsync(asset, { library, signal }).catch(warnOnce);
    return isMade ? 'local' : 'notUploaded';
  }
  return isAuthenticated ? 'remote' : 'signedOut';
}

function warnOnce(error: unknown): false {
  if (!hasWarned) console.warn('Could not make a thumbnail again from its original', error);
  hasWarned = true;
  return false;
}
