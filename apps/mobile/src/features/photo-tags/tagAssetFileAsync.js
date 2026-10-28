import { setTags } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '@/utils/cloud-api/ai/tagPhotoAsync';

/**
 * One tagging, outside tagAttempts (callers go through tagAssetAsync or tagAssetOnce): the asset's
 * thumbnail to POST /ai/tags, the tags stored on it; fails when the photo was deleted meanwhile.
 */
export default async function tagAssetFileAsync(asset, deps) {
  // The library's database as the tagging starts, so the tags land in the library the photo is in.
  const db = getDb();
  const tags = await tagPhotoAsync(await readVisionImageAsync(asset, deps));
  const stored = await setTags(db, asset.id, tags);
  if (!stored) throw new Error('This photo was deleted');
  requestSync();
  return stored;
}
