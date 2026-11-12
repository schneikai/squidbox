import { File, type UploadProgress, type UploadResult, UploadType } from 'expo-file-system';

import UploadFailedError from '@/features/cloud/assets/UploadFailedError';
import cancelledError from '@/features/cloud/assets/cancelledError';
import type { SyncIdentity } from '@/library/sessionMatches';
import refreshAccessTokenAsync from '@/utils/cloud-api/authentication/refreshAccessTokenAsync';
import { clientHeader } from '@/utils/cloud-api/clientHeader';
import envelopeMessage from '@/utils/cloud-api/envelopeMessage';
import requireApiBaseUrl from '@/utils/cloud-api/requireApiBaseUrl';
import requireSession from '@/utils/cloud-api/requireSession';

type UploadOptions = { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal };

// Uploads a file to the API which proxies it to S3 synchronously.
// The API only responds 200 after S3 confirms the upload, so no extra validation is needed.
// The access token is read fresh for `identity`, the user the upload runs for, and refused once
// someone else is signed in (requireSession). `onProgress({ bytesSent, totalBytes })` follows it;
// aborting `signal` cancels it, which rejects with an `AbortError` (like downloadAssetFileAsync). A
// refused one rejects with an UploadFailedError.
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
    headers: clientHeader(),
    uploadType: UploadType.BINARY_CONTENT,
    // expo-modules-core hands the native task's Int64 byte counts (and the File.size of the
    // task's own final report) to JS as BigInts, though UploadProgress types them as numbers.
    onProgress: onProgress && (({ bytesSent, totalBytes }) => onProgress(byteCounts(bytesSent, totalBytes))),
    signal,
  });

  try {
    return await uploadTask.uploadAsync();
  } catch (error) {
    if (signal?.aborted) throw cancelled(filename);
    throw error;
  }
}

// Byte counts as numbers, whether the native side sent numbers or BigInts.
function byteCounts(bytesSent: number | bigint, totalBytes: number | bigint): UploadProgress {
  return { bytesSent: Number(bytesSent), totalBytes: Number(totalBytes) };
}

function assertSuccess(result: UploadResult | undefined, filename: string, signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled(filename);
  if (!result || result.status < 200 || result.status >= 300) {
    const body = parseBody(result?.body);
    throw new UploadFailedError(envelopeMessage(body) ?? `Upload failed with status ${result?.status}`, {
      status: result?.status,
      code: envelopeCode(body),
    });
  }
}

// The body as JSON, or nothing when it isn't (a proxy's HTML page).
function parseBody(body: string | undefined): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

// The error code of the server's envelope (`read_only_library`, `rate_limited`…), else null.
function envelopeCode(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('error' in data)) return null;
  const { error } = data;
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}
