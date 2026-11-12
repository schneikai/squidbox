import {
  type AssetFileAsset,
  type AssetFileLocation,
  type UnavailableStatus,
  cloudFileStatus,
} from './getAssetFileStatusAsync';

import { findLocalAssetFileAsync } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

// The members a caller doesn't get are undefined, so `source.status` and `source.isRemote` read on either.
// `isKeptDownload`: a local uri that is a kept download of the cloud copy, not the original.
export type AssetFileSource =
  | { uri: string; isRemote: boolean; isKeptDownload?: boolean; status?: undefined }
  | { uri?: undefined; isRemote?: undefined; isKeptDownload?: undefined; status: UnavailableStatus };

// Where to read an asset's full-resolution file now (see getAssetFileStatusAsync): resolves
// `{ uri, isRemote }`, the cloud copy's being a presigned URL, or `{ status }` when it can't be had.
// A local file is the original, or else a kept download (`isKeptDownload`).
export default async function getAssetFileSourceAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library }: AssetFileLocation,
): Promise<AssetFileSource> {
  const local = await findLocalAssetFileAsync(asset.filename, library);
  if (local) return { uri: local.uri, isRemote: false, isKeptDownload: local.isKeptDownload };
  const status = cloudFileStatus(asset, isAuthenticated);
  if (status !== 'remote') return { status };
  return { uri: await getAssetFileDownloadUrlAsync(asset.filename), isRemote: true };
}
