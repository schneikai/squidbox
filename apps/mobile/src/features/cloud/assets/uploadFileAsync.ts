import { File, type UploadProgress, type UploadResult, UploadType } from 'expo-file-system';

import cancelledError from '@/features/cloud/assets/cancelledError';
import type { SyncIdentity } from '@/library/sessionMatches';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';
import envelopeMessage from '@/utils/cloud-api/envelopeMessage';
import requireApiBaseUrl from '@/utils/cloud-api/requireApiBaseUrl';
import requireSession from '@/utils/cloud-api/requireSession';

type UploadOptions = { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal };

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
// The access token is read fresh for `identity`, the user the upload runs for, and refused once
// someone else is signed in (requireSession). `onProgress({ bytesSent, totalBytes })` follows it;
// aborting `signal` cancels it, which rejects with an `AbortError` (like downloadAssetFileAsync).
export default async function uploadFileAsync(
  filename: string,
  fileUri: string,
  identity: SyncIdentity,
  { onProgress, signal }: UploadOptions = {},
): Promise<void> {
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

const cancelled = (filename: string) => cancelledError(`Uploading ${filename} was cancelled`);

async function doUploadAsync(
  filename: string,
  fileUri: string,
  accessToken: string,
  { onProgress, signal }: UploadOptions,
): Promise<UploadResult> {
  // A signal aborted before this upload starts (during the token refresh, say) fires no event.
  if (signal?.aborted) throw cancelled(filename);
  // Token is passed as a query param because iOS can silently drop Authorization
  // headers on background upload tasks (NSURLSessionUploadTask limitation).
  // The API's authenticate_request supports both header and ?token= param.
  const uploadUrl = `${requireApiBaseUrl()}/assets/upload/${encodeURIComponent(filename)}?token=${accessToken}`;

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

function assertSuccess(result: UploadResult | undefined, filename: string, signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled(filename);
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(serverErrorMessage(result?.body) ?? `Upload failed with status ${result?.status}`);
  }
}

// The server's error message, if the body is its JSON error envelope (a proxy's HTML page isn't).
function serverErrorMessage(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    return envelopeMessage(JSON.parse(body));
  } catch {
    return undefined;
  }
}
