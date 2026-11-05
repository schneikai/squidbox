import type { AssetRecord } from '@squidbox/shared';

import getAssetFileStatusAsync, { type AssetFileLocation } from './getAssetFileStatusAsync';

import { getAssetFileUri } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

// Where to read an asset's full-resolution file now (see getAssetFileStatusAsync): resolves
// `{ uri, isRemote }`, the cloud copy's being a presigned URL, or `{ status }` when it can't be had.
// The members a caller doesn't get are undefined, so `source.status` and `source.isRemote` read on either.
export type AssetFileSource =
  | { uri: string; isRemote: boolean; status?: undefined }
  | { uri?: undefined; isRemote?: undefined; status: 'notUploaded' | 'signedOut' };

export default async function getAssetFileSourceAsync(
  asset: Pick<AssetRecord, 'filename' | 'isFileSynced'>,
  { isAuthenticated, library }: AssetFileLocation,
): Promise<AssetFileSource> {
  const status = await getAssetFileStatusAsync(asset, { isAuthenticated, library });
  if (status === 'local') return { uri: getAssetFileUri(asset.filename, library), isRemote: false };
  if (status !== 'remote') return { status };
  const uri = await getAssetFileDownloadUrlAsync(asset.filename);
  if (!uri) throw new Error(`No download URL for ${asset.filename}`);
  return { uri, isRemote: true };
}
