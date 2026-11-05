import type { AssetRecord } from '@squidbox/shared';

import type { LibraryPaths } from '@/library/libraryPaths';
import { assetFileExistsAsync } from '@/utils/assets/assetStorage';

export type AssetFileStatus = 'local' | 'remote' | 'notUploaded' | 'signedOut';
// Why a file can't be had (assetFileUnavailableMessages says it).
export type UnavailableStatus = Exclude<AssetFileStatus, 'local' | 'remote'>;
// What finding an asset's full-resolution file reads of it.
export type AssetFileAsset = Pick<AssetRecord, 'filename' | 'isFileSynced'>;
export type AssetFileLocation = { isAuthenticated: boolean; library: LibraryPaths };

// Where an asset's full-resolution file can be had, without asking the cloud for it: 'local' (its
// copy on this device, until the backup has uploaded it; never on web), 'remote' (the cloud copy),
// or why it can't: 'notUploaded' (neither here nor in the cloud yet) or 'signedOut'.
export default async function getAssetFileStatusAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library }: AssetFileLocation,
): Promise<AssetFileStatus> {
  if (await assetFileExistsAsync(asset.filename, library)) return 'local';
  if (!asset.isFileSynced) return 'notUploaded';
  return isAuthenticated ? 'remote' : 'signedOut';
}
