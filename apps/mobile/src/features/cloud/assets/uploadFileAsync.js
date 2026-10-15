import * as FileSystem from 'expo-file-system/legacy';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';
import requireSession from '@/utils/cloud-api/requireSession';

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
// The access token is read fresh for `identity`, the user the upload runs for, and refused once
// someone else is signed in (requireSession). Aborting `signal` cancels the upload in flight.
export default async function uploadFileAsync(filename, fileUri, identity, { onProgress, signal } = {}) {
  const { tokens } = requireSession(identity);
  const result = await doUploadAsync(filename, fileUri, tokens.accessToken, { onProgress, signal });

  if (result?.status === 401) {
    // Token expired mid-session — refresh and retry once.
    const newAccessToken = await refreshAccessTokenAsync(identity);
    const retryResult = await doUploadAsync(filename, fileUri, newAccessToken, { onProgress, signal });
    assertSuccess(retryResult, signal);
    return;
  }

  assertSuccess(result, signal);
}

async function doUploadAsync(filename, fileUri, accessToken, { onProgress, signal }) {
  // Token is passed as a query param because iOS can silently drop Authorization
  // headers on background upload tasks (NSURLSessionUploadTask limitation).
  // The API's authenticate_request supports both header and ?token= param.
  const uploadUrl = `${API_BASE_URL}/assets/upload/${encodeURIComponent(filename)}?token=${accessToken}`;

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

  const cancel = () => uploadTask.cancelAsync();
  signal?.addEventListener('abort', cancel);
  try {
    return await uploadTask.uploadAsync();
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

function assertSuccess(result, signal) {
  if (signal?.aborted) throw new Error('Upload cancelled');
  if (!result || result.status < 200 || result.status >= 300) {
    const serverError = result?.body ? JSON.parse(result.body)?.error : null;
    throw new Error(serverError || `Upload failed with status ${result?.status}`);
  }
}
