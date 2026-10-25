import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import readFileAsBase64Async from '@/utils/files/readFileAsBase64Async';

const THUMBNAIL_TIMEOUT_MS = 60_000;

/**
 * A photo for the vision compare, `{ base64, mimeType }`: the asset's thumbnail as it is (a 1000 px
 * JPEG; a video's is its frame). It works for photos not backed up yet; one whose thumbnail is
 * only in the cloud is fetched first through the thumbnail loader, given up on when `signal`
 * aborts or after THUMBNAIL_TIMEOUT_MS. Throws with why when there's none to be had.
 */
export default async function readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated, signal }) {
  const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated, library });
  if (status === 'remote') await loadThumbnailAsync(asset, loadThumbnail, signal);
  else if (status !== 'local') throw new Error(assetFileUnavailableMessages[status].title);

  const base64 = await readFileAsBase64Async(getAssetThumbnailUri(asset.thumbnailFilename, library));
  return { base64, mimeType: 'image/jpeg' };
}

// The loader drops its requests on a sign-out without calling back, so the wait has its own end.
function loadThumbnailAsync(asset, loadThumbnail, signal) {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    let withdraw = null;
    function settle(error) {
      if (isSettled) return;
      isSettled = true;
      withdraw?.();
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      if (error) reject(error);
      else resolve();
    }
    function handleAbort() {
      settle(new Error('The compare was stopped'));
    }
    const timer = setTimeout(() => settle(new Error("Couldn't fetch the thumbnail")), THUMBNAIL_TIMEOUT_MS);
    signal?.addEventListener('abort', handleAbort);
    withdraw = loadThumbnail(asset, (result) =>
      settle(result === 'done' ? null : new Error("Couldn't fetch the thumbnail")),
    );
    if (isSettled) withdraw(); // called back at once
    if (signal?.aborted) handleAbort();
  });
}
