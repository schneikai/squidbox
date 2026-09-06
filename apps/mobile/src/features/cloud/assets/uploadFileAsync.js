import * as FileSystem from 'expo-file-system/legacy';

import { getAccessTokenAsync, getRefreshTokenAsync } from '@/utils/cloud-api/apiTokenStore';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
export default async function uploadFileAsync(filename, fileUri, onProgress = null) {
  const accessToken = await getAccessTokenAsync();
  const result = await doUploadAsync(filename, fileUri, accessToken, onProgress);

  if (result?.status === 401) {
    // Token expired mid-session — refresh and retry once.
    const refreshToken = await getRefreshTokenAsync();
    const newAccessToken = await refreshAccessTokenAsync(refreshToken);
    const retryResult = await doUploadAsync(filename, fileUri, newAccessToken, onProgress);
    assertSuccess(retryResult);
    return;
  }

  assertSuccess(result);
}

async function doUploadAsync(filename, fileUri, accessToken, onProgress) {
  // Token is passed as a query param because iOS can silently drop Authorization
  // headers on background upload tasks (NSURLSessionUploadTask limitation).
  // The API's authenticate_request supports both header and ?token= param.
  const uploadUrl = `${process.env.EXPO_PUBLIC_API_URL}/asset_files/upload/${encodeURIComponent(
    filename,
  )}?token=${accessToken}`;

  // TODO: We could return the uploadTask.cancelAsync() method from this function
  // to allow to cancel the upload if needed.
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

  return uploadTask.uploadAsync();
}

function assertSuccess(result) {
  if (!result || result.status < 200 || result.status >= 300) {
    const serverError = result?.body ? JSON.parse(result.body)?.error : null;
    throw new Error(serverError || `Upload failed with status ${result?.status}`);
  }
}
