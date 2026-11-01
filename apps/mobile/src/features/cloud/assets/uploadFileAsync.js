import { File, UploadType } from 'expo-file-system';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';
import requireSession from '@/utils/cloud-api/requireSession';

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
// The access token is read fresh for `identity`, the user the upload runs for, and refused once
// someone else is signed in (requireSession). `onProgress({ bytesSent, totalBytes })` follows it;
// aborting `signal` cancels it, which rejects with an `AbortError` (like downloadAssetFileAsync).
export default async function uploadFileAsync(filename, fileUri, identity, { onProgress, signal } = {}) {
  const { tokens } = requireSession(identity);
  const result = await doUploadAsync(filename, fileUri, tokens.accessToken, { onProgress, signal });

  if (result?.status === 401) {
    // Token expired mid-session — refresh and retry once.
    const newAccessToken = await refreshAccessTokenAsync(identity);
    const retryResult = await doUploadAsync(filename, fileUri, newAccessToken, { onProgress, signal });
    assertSuccess(retryResult, filename, signal);
    return;
  }

  assertSuccess(result, filename, signal);
}

const cancelled = (filename) => Object.assign(new Error(`Uploading ${filename} was cancelled`), { name: 'AbortError' });

async function doUploadAsync(filename, fileUri, accessToken, { onProgress, signal }) {
  // A signal aborted before this upload starts (during the token refresh, say) fires no event.
  if (signal?.aborted) throw cancelled(filename);
  // Token is passed as a query param because iOS can silently drop Authorization
  // headers on background upload tasks (NSURLSessionUploadTask limitation).
  // The API's authenticate_request supports both header and ?token= param.
  const uploadUrl = `${API_BASE_URL}/assets/upload/${encodeURIComponent(filename)}?token=${accessToken}`;

  const uploadTask = new File(fileUri).createUploadTask(uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    onProgress,
    signal,
  });

  try {
    return await uploadTask.uploadAsync();
  } catch (error) {
    if (signal?.aborted) throw cancelled(filename);
    throw error;
  }
}

function assertSuccess(result, filename, signal) {
  if (signal?.aborted) throw cancelled(filename);
  if (!result || result.status < 200 || result.status >= 300) {
    const serverError = result?.body ? JSON.parse(result.body)?.error : null;
    throw new Error(serverError || `Upload failed with status ${result?.status}`);
  }
}
