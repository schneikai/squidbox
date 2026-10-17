import createAssetThumbnail from './createAssetThumbnail';
import hasThumbnailAsync from './hasThumbnailAsync';

import { getLibrary } from '@/library/current';
import assetFileExistsAsync from '@/utils/assets/files/assetFileExistsAsync';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';

const MAX_MAKING = 2; // thumbnails made from full-size originals at once
const jobs = new Map(); // by library and name, waiting or running: a tile and the backup share one
const waiting = []; // the jobs not started, the newest last
let running = 0;

// Resolves whether the asset's thumbnail is on the device, made again from the original when it's
// missing and the original is here (a merge brings originals without their thumbnails). At most two
// are made at once, the newest asked for first; one whose callers all aborted `signal` is skipped
// (resolves false).
export default function ensureAssetThumbnailAsync(asset, { library = getLibrary(), signal } = {}) {
  if (signal?.aborted) return Promise.resolve(false);
  const key = `${library.thumbnailsDir}${asset.thumbnailFilename}`;
  let job = jobs.get(key);
  if (!job) {
    job = { key, asset, library, callers: 0, isStarted: false };
    job.promise = new Promise((resolve, reject) => Object.assign(job, { resolve, reject }));
    jobs.set(key, job);
  } else if (!job.isStarted) {
    waiting.splice(waiting.indexOf(job), 1);
  }
  if (!job.isStarted) waiting.push(job);
  job.callers += 1;
  signal?.addEventListener('abort', () => leave(job), { once: true });
  next();
  return job.promise;
}

function leave(job) {
  job.callers -= 1;
  if (job.callers > 0 || job.isStarted) return;
  waiting.splice(waiting.indexOf(job), 1);
  jobs.delete(job.key);
  job.resolve(false);
}

function next() {
  while (running < MAX_MAKING && waiting.length > 0) {
    const job = waiting.pop();
    job.isStarted = true;
    running += 1;
    makeAsync(job.asset, job.library)
      .then(job.resolve, job.reject)
      .finally(() => {
        running -= 1;
        jobs.delete(job.key);
        next();
      });
  }
}

// Checked here, when it runs: the backup may have deleted the original since it was asked for.
async function makeAsync(asset, library) {
  if (await hasThumbnailAsync(asset.thumbnailFilename, library)) return true;
  if (!(await assetFileExistsAsync(asset.filename, library))) return false;
  const fileUri = getAssetFileUri(asset.filename, library);
  const { thumbnailFilename } = asset;
  await createAssetThumbnail(asset.id, fileUri, asset.mediaType, library, { thumbnailFilename });
  return true;
}
