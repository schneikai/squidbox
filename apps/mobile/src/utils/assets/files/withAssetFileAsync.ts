import { File } from 'expo-file-system';

import getAssetFileSourceAsync from './getAssetFileSourceAsync';
import type { AssetFileAsset, AssetFileLocation } from './getAssetFileStatusAsync';

import { getDownloadFolderUri, markDownloadUsed } from '@/utils/assets/assetStorage';
import downloadAssetFileAsync, { type DownloadProgressOptions } from '@/utils/cloud-api/assets/downloadAssetFileAsync';
import deletePath from '@/utils/files/deletePath';

export type WithAssetFileOptions = AssetFileLocation & DownloadProgressOptions;

// Runs `run` with a local uri of an asset's full-resolution file: the on-device original (kept, the
// upload still needs it), a download of the cloud copy kept from the last day (marked used again),
// or else the cloud copy downloaded into the asset's download folder (getDownloadFolderUri) and kept
// there for a later run, `run` included, which may read the file after it returns
// (deleteStaleDownloadsAsync removes it a day after its last use). The download lands in the
// folder's `partial/` and moves up only once whole, so a Cancel or a crash mid-download never leaves
// a file that gets reused; on a failure the folder goes. Resolved right before, so a URL hasn't
// expired. `onProgress` gets the share of the download done (0–1); `signal` cancels it.
export default async function withAssetFileAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library, onProgress, signal }: WithAssetFileOptions,
  run: (uri: string) => Promise<unknown> | unknown,
): Promise<void> {
  const source = await getAssetFileSourceAsync(asset, { isAuthenticated, library });
  if (source.status) throw new Error(`${asset.filename} is ${source.status}`);

  if (source.isKeptDownload) markDownloadUsed(asset.filename, library);
  const uri = source.isRemote
    ? await downloadToKeepAsync(asset, source.uri, library, { onProgress, signal })
    : source.uri;
  await run(uri);
}

async function downloadToKeepAsync(
  asset: AssetFileAsset,
  downloadUrl: string,
  library: AssetFileLocation['library'],
  progress: DownloadProgressOptions,
): Promise<string> {
  const folder = getDownloadFolderUri(asset.filename, library);
  const partial = `${folder}partial/`;
  const uri = `${folder}${asset.filename}`;
  try {
    const downloaded = await downloadAssetFileAsync(asset, downloadUrl, partial, progress);
    await new File(downloaded).move(new File(uri), { overwrite: true });
    deletePath(partial);
  } catch (error) {
    // Best effort, so it never hides the outcome: the stale sweep gets what stays.
    try {
      deletePath(folder);
    } catch (deleteError) {
      console.warn(deleteError);
    }
    throw error;
  }
  markDownloadUsed(asset.filename, library);
  return uri;
}
