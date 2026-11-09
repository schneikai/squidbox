import createTagAttempts from '@/features/photo-tags/createTagAttempts';
import createStore from '@/lib/createStore';
import type { AssetRow } from '@/sync/db/schema';
import readVisionImageAsync, { type VisionAsset, type VisionImageReadDeps } from '@/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '@/utils/cloud-api/ai/tagPhotoAsync';

// The tags the post chat got for photos never tagged, by asset id, for this app run. They are the
// assistant's guess, never checked by the user, so they stay here and never reach the photo.
const tags = createStore<Partial<Record<string, string[]>>>({});
const attempts = createTagAttempts();

/** Tags the photo for the chat (POST /ai/tags on its thumbnail) and keeps the tags here, not on the photo. */
async function tagAsync(asset: VisionAsset, deps: VisionImageReadDeps): Promise<string[]> {
  const result = await tagPhotoAsync(await readVisionImageAsync(asset, deps));
  tags.set((current) => ({ ...current, [asset.id]: result }));
  return result;
}

/** `rows` with the chat's tags on those never tagged; the rows as they are when it has none for them. */
function withTags<Row extends Pick<AssetRow, 'id' | 'tags'>>(
  rows: readonly Row[],
  byId: Partial<Record<string, string[]>> = tags.get(),
): Row[] {
  return rows.map((row) => {
    const kept = byId[row.id];
    return row.tags === null && kept ? { ...row, tags: kept } : row;
  });
}

/**
 * The post chat's own tagging of the photos never tagged: `run(asset, deps)` (tags it again, joining
 * one under way) and `once(asset, deps)` (unless it was tried in this app run), both keeping the tags
 * in memory only; `attempts` (createTagAttempts', the chat's taggings), `tags` (the store of the tags
 * it got, by asset id) and `withTags(rows, byId?)`. A photo with stored tags is never tagged here:
 * only Tag it on the photo and the album's Tags store AI tags on a photo.
 */
const chatTags = {
  run: (asset: VisionAsset, deps: VisionImageReadDeps) => attempts.run(asset.id, () => tagAsync(asset, deps)),
  once: (asset: VisionAsset, deps: VisionImageReadDeps) => attempts.once(asset.id, () => tagAsync(asset, deps)),
  attempts,
  tags,
  withTags,
};

export default chatTags;
