import getAssetFileStatusAsync, {
  type AssetFileAsset,
  type AssetFileLocation,
  type UnavailableStatus,
} from './getAssetFileStatusAsync';

import { getAssetFileUri } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

// The members a caller doesn't get are undefined, so `source.status` and `source.isRemote` read on either.
export type AssetFileSource =
  | { uri: string; isRemote: boolean; status?: undefined }
  | { uri?: undefined; isRemote?: undefined; status: UnavailableStatus };

// Where to read an asset's full-resolution file now (see getAssetFileStatusAsync): resolves
// `{ uri, isRemote }`, the cloud copy's being a presigned URL, or `{ status }` when it can't be had.
export default async function getAssetFileSourceAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library }: AssetFileLocation,
): Promise<AssetFileSource> {
  const status = await getAssetFileStatusAsync(asset, { isAuthenticated, library });
  if (status === 'local') return { uri: getAssetFileUri(asset.filename, library), isRemote: false };
  if (status !== 'remote') return { status };
  return { uri: await getAssetFileDownloadUrlAsync(asset.filename), isRemote: true };
}
