import * as FileSystem from 'expo-file-system';

import getAssetFileInfoAsync from '@/utils/cloud-api/assets/getAssetFileInfoAsync';
import getAssetFileUploadUrlAsync from '@/utils/cloud-api/assets/getAssetFileUploadUrlAsync';
import getFileChecksumAsync from '@/utils/files/getFileChecksumAsync';
import normalizeS3Etag from '@/utils/normalizeS3Etag';

export default async function uploadFileAsync(filename, fileUri) {
  const localFileChecksum = await getFileChecksumAsync(fileUri);
  const presignedUrl = await getAssetFileUploadUrlAsync(filename);

  await FileSystem.uploadAsync(presignedUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  const { exists, etag } = await getAssetFileInfoAsync(filename);

  if (!exists) {
    throw new Error('File upload failed! File now found on server.');
  }

  const remoteFileChecksum = normalizeS3Etag(etag);

  if (localFileChecksum !== remoteFileChecksum) {
    throw new Error('File upload failed! Checksums do not match.');
  }
}
