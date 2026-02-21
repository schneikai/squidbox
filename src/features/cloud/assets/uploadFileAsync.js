import * as FileSystem from 'expo-file-system';

import { getAccessTokenAsync } from '@/utils/cloud-api/apiTokenStore';

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
export default async function uploadFileAsync(filename, fileUri, onProgress = null) {
  const accessToken = await getAccessTokenAsync();

  // Token is passed as a query param because iOS can silently drop Authorization
  // headers on background upload tasks (NSURLSessionUploadTask limitation).
  // The API's authenticate_request supports both header and ?token= param.
  const uploadUrl = `${process.env.EXPO_PUBLIC_API_URL}/asset_files/upload/${encodeURIComponent(filename)}?token=${accessToken}`;

  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
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
  const result = await uploadTask.uploadAsync();

  if (!result || result.status < 200 || result.status >= 300) {
    const serverError = result?.body ? JSON.parse(result.body)?.error : null;
    throw new Error(serverError || `Upload failed with status ${result?.status}`);
  }
}
