import * as FileSystem from 'expo-file-system/legacy';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';
import requireSessionAsync from '@/utils/cloud-api/requireSessionAsync';

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
// The access token is read fresh for `identity`, the user the upload runs for, and refused once
// someone else is signed in (requireSessionAsync).
export default async function uploadFileAsync(filename, fileUri, identity, onProgress = null) {
  const { tokens } = await requireSessionAsync(identity);
  const result = await doUploadAsync(filename, fileUri, tokens.accessToken, onProgress);

  if (result?.status === 401) {
    // Token expired mid-session — refresh and retry once.
    const newAccessToken = await refreshAccessTokenAsync(identity);
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
  const uploadUrl = `${API_BASE_URL}/assets/upload/${encodeURIComponent(filename)}?token=${accessToken}`;

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
