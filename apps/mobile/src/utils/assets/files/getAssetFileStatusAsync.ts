import type { AssetRecord } from '@squidbox/shared';

import type { LibraryPaths } from '@/library/libraryPaths';
import { findLocalAssetFileAsync } from '@/utils/assets/assetStorage';

export type AssetFileStatus = 'local' | 'remote' | 'notUploaded' | 'signedOut';
// Why a file can't be had (assetFileUnavailableMessages says it).
export type UnavailableStatus = Exclude<AssetFileStatus, 'local' | 'remote'>;
// What finding an asset's full-resolution file reads of it.
export type AssetFileAsset = Pick<AssetRecord, 'filename' | 'isFileSynced'>;
export type AssetFileLocation = { isAuthenticated: boolean; library: LibraryPaths };

// Where an asset's full-resolution file can be had, without asking the cloud for it: 'local' (on this
// device: findLocalAssetFileAsync; never on web), 'remote' (the cloud copy), or why it can't:
// 'notUploaded' (neither here nor in the cloud yet) or 'signedOut'.
export default async function getAssetFileStatusAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library }: AssetFileLocation,
): Promise<AssetFileStatus> {
  if (await findLocalAssetFileAsync(asset.filename, library)) return 'local';
  return cloudFileStatus(asset, isAuthenticated);
}

// Where the file can be had when this device has none.
export function cloudFileStatus(asset: AssetFileAsset, isAuthenticated: boolean): Exclude<AssetFileStatus, 'local'> {
  if (!asset.isFileSynced) return 'notUploaded';
  return isAuthenticated ? 'remote' : 'signedOut';
}
