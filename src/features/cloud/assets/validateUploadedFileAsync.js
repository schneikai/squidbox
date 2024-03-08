import * as FileSystem from 'expo-file-system';

import getAssetFileInfoAsync from '@/utils/cloud-api/assets/getAssetFileInfoAsync';
import getFileChecksumAsync from '@/utils/files/getFileChecksumAsync';

// Validates that a file has been uploaded to the cloud successfully by comparing its checksum
// or file size with the remote file.
// Heads-up: There is a bug in Expo that makes it crash when trying to read the checksum from
// files larger than 2GB. For such files, we can only validate them by comparing their file size.
// Another heads-up: The app was crashing too when trying to read the file size of files larger
// than 3GB. I added the option to pass in the file size. So when you upload a Asset you can
// pass in asset.fileSize property to avoid having to read the file size in this function.
export default async function validateUploadedFileAsync(localFileUri, remoteFilename, localFileSize = null) {
  const { exists, etag, contentLength } = await getAssetFileInfoAsync(remoteFilename);

  if (!exists) {
    return { valid: false, message: 'File not found on server.' };
  }

  if (localFileSize === null) {
    localFileSize = (await FileSystem.getInfoAsync(localFileUri)).size;
  }

  // If the file is larger than 2GB, validate by comparing file sizes.
  // On smaller size, compare the checksums.
  if (localFileSize > 2 * 1024 * 1024 * 1024) {
    if (localFileSize !== contentLength) {
      return { valid: false, message: `File sizes do not match! Local: ${localFileSize}, Remote: ${contentLength}` };
    }
  } else {
    const localFileChecksum = await getFileChecksumAsync(localFileUri);
    if (localFileChecksum !== etag) {
      return { valid: false, message: `Checksums do not match! Local: ${localFileChecksum}, Remote: ${etag}` };
    }
  }

  return { valid: true };
}
