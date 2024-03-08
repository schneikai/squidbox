import * as FileSystem from 'expo-file-system';

import validateUploadedFileAsync from '@/features/cloud/assets/validateUploadedFileAsync';
import getAssetFileUploadUrlAsync from '@/utils/cloud-api/assets/getAssetFileUploadUrlAsync';

// Uploads a file to the cloud and validates the upload.
export default async function uploadFileAsync(filename, fileUri, fileSize = null) {
  const presignedUrl = await getAssetFileUploadUrlAsync(filename);

  await FileSystem.uploadAsync(presignedUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  const result = await validateUploadedFileAsync(fileUri, filename, fileSize);

  if (!result.valid) {
    throw new Error(`File upload failed! ${result.message}`);
  }
}
