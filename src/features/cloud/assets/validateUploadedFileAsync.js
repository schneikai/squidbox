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
// 
// For large files uploaded via API proxy, the file may not exist immediately on S3
// because the upload happens in the background. We retry for up to 5 minutes.
export default async function validateUploadedFileAsync(localFileUri, remoteFilename, localFileSize = null, onProgress = null) {
  const maxRetries = 600; // 600 retries * 2s = 20 minutes (enough for 10GB+ upload to S3)
  const retryDelay = 2000; // 2 seconds between retries
  
  // Show "Validating upload..." while waiting
  if (onProgress) {
    onProgress({ message: 'Validating upload...' });
  }
  
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getAssetFileInfoAsync(remoteFilename);
      const { exists, etag, contentLength, uploadProgress } = response;

      // Show progress if available (optional)
      if (uploadProgress && onProgress) {
        if (uploadProgress.status === 'failed') {
          return { valid: false, message: `Upload failed: ${uploadProgress.error}` };
        }
        
        if (uploadProgress.status === 'uploading' && uploadProgress.progress !== undefined) {
          // Update UI with S3 upload progress (50-100%)
          onProgress({ s3Progress: uploadProgress.progress });
        }
      }

      // If file doesn't exist yet, wait and retry
      if (!exists) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (localFileSize === null) {
        localFileSize = (await FileSystem.getInfoAsync(localFileUri)).size;
      }

      // Multipart uploads have ETags in format "hash-partcount" (e.g. "abc123-5")
      // We can't validate checksum for these, only file size
      const isMultipartUpload = etag && etag.includes('-');

      // If file is larger than 2GB OR is a multipart upload, validate by comparing file sizes only
      if (localFileSize > 2 * 1024 * 1024 * 1024 || isMultipartUpload) {
        if (localFileSize !== contentLength) {
          return { valid: false, message: `File sizes do not match! Local: ${localFileSize}, Remote: ${contentLength}` };
        }
      } else {
        // For regular uploads, validate checksum
        const localFileChecksum = await getFileChecksumAsync(localFileUri);
        if (localFileChecksum !== etag) {
          return { valid: false, message: `Checksums do not match! Local: ${localFileChecksum}, Remote: ${etag}` };
        }
      }

      // Validation succeeded!
      return { valid: true };
    } catch (error) {
      // Network error or other issue - retry
      lastError = error.message;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // All retries exhausted
  return { valid: false, message: lastError || 'Validation failed after multiple retries' };
}
