import type { AssetRecord } from '@squidbox/shared';
import { Directory, type DownloadProgress, File } from 'expo-file-system';

import cancelledError from '@/utils/cloud-api/assets/cancelledError';

const PROGRESS_THROTTLE = 250; // ms

// What follows the download: the share done (0–1), and the signal that cancels it.
export type DownloadProgressOptions = { onProgress: (share: number) => void; signal: AbortSignal };

// Fetches an asset's full-resolution file from `downloadUrl` (getAssetFileSourceAsync's) into
// `directory`, which the caller removes, and resolves its uri. `onProgress` gets the share done
// (0–1); aborting `signal` cancels the download, which rejects with an `AbortError` (also when it
// lands as the download finishes, so nothing uses a file after a Cancel). A response that isn't a
// success (a presigned GET that 403s, say) rejects and writes no file.
export default async function downloadAssetFileAsync(
  { filename }: Pick<AssetRecord, 'filename'>,
  downloadUrl: string,
  directory: string,
  { onProgress, signal }: DownloadProgressOptions,
): Promise<string> {
  const cancelled = () => cancelledError(`Downloading ${filename} was cancelled`);
  new Directory(directory).create({ intermediates: true, idempotent: true });

  // We throttle the progress updates because the frequent rerendering slows down the download.
  let lastUpdateTime = 0;
  function throttledProgress(progress: DownloadProgress) {
    const currentTime = Date.now();
    // expo-modules-core hands the native task's Int64 byte counts to JS as BigInts, though
    // DownloadProgress types them as numbers.
    const bytesWritten = Number(progress.bytesWritten);
    const totalBytes = Number(progress.totalBytes);
    // The total is unknown (0 or less) when the response has no Content-Length.
    if (currentTime - lastUpdateTime > PROGRESS_THROTTLE && totalBytes > 0) {
      onProgress(bytesWritten / totalBytes);
      lastUpdateTime = currentTime;
    }
  }

  try {
    const file = await File.downloadFileAsync(downloadUrl, new File(`${directory}${filename}`), {
      onProgress: throttledProgress,
      signal,
    });
    if (signal.aborted) throw cancelled();
    return file.uri;
  } catch (error) {
    // However the native side ends a cancelled download, it's the Cancel.
    if (signal.aborted) throw cancelled();
    throw new Error(`Downloading ${filename} failed: ${(error as Error).message}`, { cause: error });
  }
}
