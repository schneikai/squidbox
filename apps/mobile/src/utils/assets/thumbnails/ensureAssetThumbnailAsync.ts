import type { AssetRecord } from '@squidbox/shared';

import createAssetThumbnail from './createAssetThumbnail';

import type { LibraryPaths } from '@/library/libraryPaths';
import { hasThumbnailAsync, assetFileExistsAsync, getAssetFileUri } from '@/utils/assets/assetStorage';

export type ThumbnailAsset = Pick<AssetRecord, 'id' | 'filename' | 'thumbnailFilename' | 'mediaType'>;

// One thumbnail to make, shared by everyone who asks for it; `resolve`/`reject` settle `promise`.
type Job = {
  key: string;
  asset: ThumbnailAsset;
  library: LibraryPaths;
  callers: number;
  isStarted: boolean;
  promise: Promise<boolean>;
  resolve: (isMade: boolean) => void;
  reject: (error: unknown) => void;
};

const MAX_MAKING = 2; // thumbnails made from full-size originals at once
const jobs = new Map<string, Job>(); // by library and name, waiting or running: a tile and the backup share one
const waiting: Job[] = []; // the jobs not started, the newest last
let running = 0;

// Resolves whether the asset's thumbnail is on the device, made again from the original when it's
// missing and the original is in `library` (a merge brings originals without their thumbnails). At
// most two are made at once, the newest asked for first; one whose callers all aborted `signal` is
// skipped (resolves false).
export default function ensureAssetThumbnailAsync(
  asset: ThumbnailAsset,
  { library, signal }: { library: LibraryPaths; signal?: AbortSignal },
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  const key = `${library.thumbnailsDir}${asset.thumbnailFilename}`;
  let job = jobs.get(key);
  if (!job) {
    let resolve!: Job['resolve'];
    let reject!: Job['reject'];
    const promise = new Promise<boolean>((resolveJob, rejectJob) => {
      resolve = resolveJob;
      reject = rejectJob;
    });
    job = { key, asset, library, callers: 0, isStarted: false, promise, resolve, reject };
    jobs.set(key, job);
  } else if (!job.isStarted) {
    waiting.splice(waiting.indexOf(job), 1);
  }
  if (!job.isStarted) waiting.push(job);
  job.callers += 1;
  const joined = job;
  signal?.addEventListener('abort', () => leave(joined), { once: true });
  next();
  return job.promise;
}

function leave(job: Job) {
  job.callers -= 1;
  if (job.callers > 0 || job.isStarted) return;
  waiting.splice(waiting.indexOf(job), 1);
  jobs.delete(job.key);
  job.resolve(false);
}

function next() {
  while (running < MAX_MAKING && waiting.length > 0) {
    const job = waiting.pop()!;
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
async function makeAsync(asset: ThumbnailAsset, library: LibraryPaths): Promise<boolean> {
  if (await hasThumbnailAsync(asset.thumbnailFilename, library)) return true;
  if (!(await assetFileExistsAsync(asset.filename, library))) return false;
  const fileUri = getAssetFileUri(asset.filename, library);
  const { thumbnailFilename } = asset;
  await createAssetThumbnail(asset.id, fileUri, asset.mediaType, library, { thumbnailFilename });
  return true;
}
