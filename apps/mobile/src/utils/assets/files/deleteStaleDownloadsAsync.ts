import { Directory } from 'expo-file-system';

import type { LibraryPaths } from '@/library/libraryPaths';
import { getDownloadsDirectory, isFreshDownload } from '@/utils/assets/assetStorage';

// Deletes a library's downloads (a folder each) not used for KEEP_DOWNLOADS_FOR (a day), those an
// interrupted run left (no last-used mark) and any other entry. Best effort: never throws.
export default async function deleteStaleDownloadsAsync(library: LibraryPaths): Promise<void> {
  try {
    const directory = new Directory(getDownloadsDirectory(library));
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      if (!isFreshDownload(entry.uri)) entry.delete();
    }
  } catch (error) {
    console.warn('Could not delete stale downloads', error);
  }
}
