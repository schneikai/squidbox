import { setTags } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '@/utils/cloud-api/ai/tagPhotoAsync';

// The tagging under way for each asset id, which every caller joins: a photo is sent once at a time.
const inFlight = new Map();

/**
 * Tags the asset (POST /ai/tags on its thumbnail; a video's is its frame) and stores the tags on it,
 * replacing any it had; resolves to the stored list, and fails when the photo was deleted meanwhile. A tagging of the asset already under way is
 * joined rather than sent again. Once started it runs to its end and lands on the row, whoever still
 * waits for it. `deps` are readVisionImageAsync's (useVisionImageDeps).
 */
export default function tagAssetAsync(asset, deps) {
  const running = inFlight.get(asset.id);
  if (running) return running;
  const tagging = tagAsync(asset, deps).finally(() => inFlight.delete(asset.id));
  inFlight.set(asset.id, tagging);
  return tagging;
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
