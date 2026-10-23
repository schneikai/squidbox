import * as FileSystem from 'expo-file-system/legacy';

import getAssetFileSourceAsync from './getAssetFileSourceAsync';

import downloadAssetFileAsync from '@/features/cloud/assets/downloadAssetFileAsync';
import { getDownloadsDirectory } from '@/utils/assets/assetStorage';
import getNewItemId from '@/utils/getNewItemId';

// Runs `use` with a local uri of an asset's full-resolution file: the on-device original (kept, the
// upload still needs it), or the cloud copy downloaded into a folder of its own in the cache
// (`<filename>-<uuid>/`, which removeAssetFiles finds), so no other save or share touches it. That
// folder is deleted after, or on a failure, unless `keepDownloads` (deleteStaleDownloadsAsync
// removes those later). Resolved right before, so a URL
// hasn't expired. `onProgress` gets the share of the download done (0–1); `signal` cancels it.
export default async function withAssetFileAsync(
  asset,
  { isAuthenticated, library, onProgress, signal, keepDownloads },
  use,
) {
  const source = await getAssetFileSourceAsync(asset, { isAuthenticated, library });
  if (source.status) throw new Error(`${asset.filename} is ${source.status}`);

  if (!source.isRemote) {
    await use(source.uri);
    return;
  }

  const directory = `${getDownloadsDirectory(library)}${asset.filename}-${getNewItemId()}/`;
  let failed = true;
  try {
    await use(await downloadAssetFileAsync(asset, source.uri, directory, { onProgress, signal }));
    failed = false;
  } finally {
    // Best effort, so it never hides the outcome: the stale sweep gets what stays.
    if (failed || !keepDownloads) {
      await FileSystem.deleteAsync(directory, { idempotent: true }).catch((error) => console.warn(error));
    }
  }
}
