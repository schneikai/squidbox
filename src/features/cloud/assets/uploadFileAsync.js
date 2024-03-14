import * as FileSystem from 'expo-file-system';

import validateUploadedFileAsync from '@/features/cloud/assets/validateUploadedFileAsync';
import getAssetFileUploadUrlAsync from '@/utils/cloud-api/assets/getAssetFileUploadUrlAsync';

// Uploads a file to the cloud and validates the upload.
export default async function uploadFileAsync(filename, fileUri, fileSize = null, onProgress = null) {
  const presignedUrl = await getAssetFileUploadUrlAsync(filename);

  const uploadTask = FileSystem.createUploadTask(
    presignedUrl,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    ({ totalBytesExpectedToSend, totalBytesSent }) => {
      if (onProgress) {
        onProgress({ totalBytesSent, totalBytesExpectedToSend });
      }
    },
  );

  // TODO: We could return the uploadTask.cancelAsync() method from this function
  // to allow to cancel the upload if needed.
  await uploadTask.uploadAsync();

  const validationResult = await validateUploadedFileAsync(fileUri, filename, fileSize);

  if (!validationResult.valid) {
    throw new Error(`File upload failed! ${validationResult.message}`);
  }
}
