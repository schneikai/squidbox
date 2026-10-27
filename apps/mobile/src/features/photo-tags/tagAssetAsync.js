import { runTagging, tagOnce } from './tagAttempts';

import { setTags } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '@/utils/cloud-api/ai/tagPhotoAsync';

/**
 * Tags the asset (POST /ai/tags on its thumbnail; a video's is its frame) and stores the tags on it,
 * replacing any it had; resolves to the stored list, and fails when the photo was deleted meanwhile.
 * A tagging of the asset already under way is joined rather than sent again, and every screen sees
 * it (tagAttempts). Once started it runs to its end and lands on the row, whoever still waits for
 * it. `deps` are readVisionImageAsync's (useVisionImageDeps).
 */
export default function tagAssetAsync(asset, deps) {
  return runTagging(asset.id, () => tagAsync(asset, deps));
}

/** Tags the asset by itself, once in this app run (a photo the chat shows, never tagged). */
export function tagAssetOnce(asset, deps) {
  tagOnce(asset.id, () => tagAsync(asset, deps));
}

async function tagAsync(asset, deps) {
  // The library's database as the tagging starts, so the tags land in the library the photo is in.
  const db = getDb();
  const tags = await tagPhotoAsync(await readVisionImageAsync(asset, deps));
  const stored = await setTags(db, asset.id, tags);
  if (!stored) throw new Error('This photo was deleted');
  requestSync();
  return stored;
}
