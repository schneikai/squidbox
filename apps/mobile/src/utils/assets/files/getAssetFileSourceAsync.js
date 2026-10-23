import getAssetFileStatusAsync from './getAssetFileStatusAsync';

import { getAssetFileUri } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

// Where to read an asset's full-resolution file now (see getAssetFileStatusAsync): resolves
// `{ uri, isRemote }`, the cloud copy's being a presigned URL, or `{ status }` when it can't be had.
export default async function getAssetFileSourceAsync(asset, { isAuthenticated, library }) {
  const status = await getAssetFileStatusAsync(asset, { isAuthenticated, library });
  if (status === 'local') return { uri: getAssetFileUri(asset.filename, library), isRemote: false };
  if (status !== 'remote') return { status };
  const uri = await getAssetFileDownloadUrlAsync(asset.filename);
  if (!uri) throw new Error(`No download URL for ${asset.filename}`);
  return { uri, isRemote: true };
}
