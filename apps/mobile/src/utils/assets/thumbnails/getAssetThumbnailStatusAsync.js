import ensureAssetThumbnailAsync from './ensureAssetThumbnailAsync';
import hasThumbnailAsync from './hasThumbnailAsync';

let hasWarned = false;

// Where an asset's thumbnail can be had, like getAssetFileStatusAsync: 'local' (on this device, made
// again from the original if need be; on web, already fetched), 'remote' (the cloud copy), or why it
// can't: 'notUploaded' (its device hasn't backed it up yet) or 'signedOut'. Aborting `signal` (the
// tile left) skips a thumbnail still waiting to be made.
export default async function getAssetThumbnailStatusAsync(asset, { isAuthenticated, library, signal }) {
  if (await hasThumbnailAsync(asset.thumbnailFilename, library)) return 'local';
  if (!asset.isThumbnailSynced) {
    const isMade = await ensureAssetThumbnailAsync(asset, { library, signal }).catch(warnOnce);
    return isMade ? 'local' : 'notUploaded';
  }
  return isAuthenticated ? 'remote' : 'signedOut';
}

function warnOnce(error) {
  if (!hasWarned) console.warn('Could not make a thumbnail again from its original', error);
  hasWarned = true;
  return false;
}
