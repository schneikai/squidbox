import * as FileSystem from 'expo-file-system';

export default async function getFileInfoAsync(uri, options = {}) {
  // If this is done on a file that doesn't exist it throws error
  // instead of returning exists: false.
  // It seems that's a bug in expo although I coudn't find
  // anything online.
  try {
    return await FileSystem.getInfoAsync(uri, options);
  } catch (e) {
    if (e.message.includes("isn't readable")) {
      return { exists: false, isDirectory: false };
    } else {
      throw e;
    }
  }
}
