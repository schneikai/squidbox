import * as FileSystem from 'expo-file-system/legacy';

import getDownloadsDirectory from './getDownloadsDirectory';

const STALE_AFTER = 60 * 60; // s

// Deletes a library's downloads (a folder each) older than an hour: those kept for a share sheet
// (iOS doesn't always say when it's done with them) and those an interrupted run left. Best effort: never throws.
export default async function deleteStaleDownloadsAsync(library) {
  try {
    const directory = getDownloadsDirectory(library);
    if (!(await FileSystem.getInfoAsync(directory)).exists) return;
    const now = Date.now() / 1000;
    for (const name of await FileSystem.readDirectoryAsync(directory)) {
      const info = await FileSystem.getInfoAsync(directory + name);
      if (info.exists && now - info.modificationTime > STALE_AFTER) {
        await FileSystem.deleteAsync(directory + name, { idempotent: true });
      }
    }
  } catch (error) {
    console.warn('Could not delete stale downloads', error);
  }
}
