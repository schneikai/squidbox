import * as FileSystem from 'expo-file-system/legacy';

import getAssetFileSourceAsync from './getAssetFileSourceAsync';

import downloadAssetFileAsync from '@/features/cloud/assets/downloadAssetFileAsync';

// Runs `use` with a local uri of an asset's full-resolution file: the on-device original (kept, the
// upload still needs it), or the cloud copy downloaded into the cache and deleted after, unless
// `keepDownloads`. Resolved right before, so a URL hasn't expired. `onProgress` gets the share of the
// download done (0–1); `signal` cancels it.
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

  const fileUri = await downloadAssetFileAsync(asset, source.uri, library, { onProgress, signal });
  try {
    await use(fileUri);
  } finally {
    if (!keepDownloads) await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
}
