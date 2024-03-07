import { getInfoAsync } from 'expo-file-system';

export async function getFileInfo(uri, options = {}) {
  // If this is done on a file that doesn't exist it throws error
  // instead of returning exists: false.
  // It seems that's a bug in expo although I coudn't find
  // anything online.
  try {
    return await getInfoAsync(uri, options);
  } catch (e) {
    if (e.message.includes("isn't readable")) {
      return { exists: false, isDirectory: false };
    } else {
      throw e;
    }
  }
}

export async function getFileSize(uri) {
  const { exists, size } = await getFileInfo(uri);
  if (!exists) throw new Error('File not found!');
  return size;
}

// TODO: This crashes on files larger than 2GB!
export async function getFileChecksum(uri) {
  const { exists, md5 } = await getFileInfo(uri, { md5: true });
  if (!exists) throw new Error('File not found!');
  return md5;
}

export function getFilenameFromUri(uri) {
  return uri.split('/').pop();
}

export function joinPath(...parts) {
  return parts.join('/').replace(/\/+/g, '/');
}
