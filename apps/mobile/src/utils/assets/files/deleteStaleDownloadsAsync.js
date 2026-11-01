import { Directory } from 'expo-file-system';

import { getDownloadsDirectory } from '@/utils/assets/assetStorage';

const STALE_AFTER = 60 * 60 * 1000; // ms

// Deletes a library's downloads (a folder each) older than an hour: those kept for a share sheet
// (iOS doesn't always say when it's done with them) and those an interrupted run left. Best effort: never throws.
export default async function deleteStaleDownloadsAsync(library) {
  try {
    const directory = new Directory(getDownloadsDirectory(library));
    if (!directory.exists) return;
    const now = Date.now();
    for (const entry of directory.list()) {
      const { exists, modificationTime } = entry.info();
      if (exists && modificationTime != null && now - modificationTime > STALE_AFTER) entry.delete();
    }
  } catch (error) {
    console.warn('Could not delete stale downloads', error);
  }
}
