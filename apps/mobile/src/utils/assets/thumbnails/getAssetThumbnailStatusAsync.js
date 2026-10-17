import hasThumbnailAsync from './hasThumbnailAsync';

// Where an asset's thumbnail can be had, like getAssetFileStatusAsync: 'local' (on this device; on
// web, already fetched), 'remote' (the cloud copy), or why it can't: 'notUploaded' (its device hasn't
// backed it up yet) or 'signedOut'.
export default async function getAssetThumbnailStatusAsync(asset, { isAuthenticated }) {
  if (await hasThumbnailAsync(asset.thumbnailFilename)) return 'local';
  if (!asset.isThumbnailSynced) return 'notUploaded';
  return isAuthenticated ? 'remote' : 'signedOut';
}
