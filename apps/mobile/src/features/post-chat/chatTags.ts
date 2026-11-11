import tagAttempts from '@/features/photo-tags/tagAttempts';
import createStore from '@/lib/createStore';
import createTagAttempts, { type TagAttempts } from '@/lib/createTagAttempts';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
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

/**
 * `rows` with the chat's tags (`byId`, the `tags` store's value) on those never tagged; `rows` itself
 * when it has none for them.
 */
function withTags<Row extends Pick<AssetRow, 'id' | 'tags'>>(
  rows: readonly Row[],
  byId: Partial<Record<string, string[]>>,
): readonly Row[] {
  if (!rows.some((row) => row.tags === null && byId[row.id])) return rows;
  return rows.map((row) => {
    const kept = byId[row.id];
    return row.tags === null && kept ? { ...row, tags: kept } : row;
  });
}

const once = (asset: VisionAsset, deps: VisionImageReadDeps) => attempts.once(asset.id, () => tagAsync(asset, deps));

/** The photo's tagging under way: the chat's own, or one storing its tags (Tag it, Tag again). */
function runningAttempt(id: string, chat: TagAttempts = attempts.get(), stored: TagAttempts = tagAttempts.get()) {
  if (chat[id]?.status === 'loading') return chat[id];
  return stored[id]?.status === 'loading' ? stored[id] : undefined;
}

/**
 * Before a turn goes: tags the photos `assetIds` never tagged nor tried in this app run, as saved now
 * (`isAvailable`: only while the assistant is; a Tag it under way stores the photo's tags, so it is
 * waited for instead), then waits for those and every tagging of them under way, calling `onWait()`
 * first when there are any.
 */
async function tagMissingAsync(
  assetIds: readonly string[],
  { deps, isAvailable }: { deps: VisionImageReadDeps; isAvailable: boolean },
  onWait?: () => void,
): Promise<void> {
  if (isAvailable) {
    const rows = withTags(await readLiveAssets(getDb(), [...assetIds]), tags.get());
    for (const row of rows) {
      if (row.tags === null && !runningAttempt(row.id)) once(row, deps);
    }
  }
  const running = assetIds.flatMap((id) => runningAttempt(id)?.promise ?? []);
  if (running.length > 0) onWait?.();
  await Promise.allSettled(running);
}

/**
 * The post chat's own tagging of the photos never tagged: `run(asset, deps)` (tags it again, joining
 * one under way), `once(asset, deps)` (unless it was tried in this app run) and
 * `tagMissingAsync(ids, options, onWait)` (before a turn), all keeping the tags in memory only;
 * `runningAttempt(id)`; `attempts` (createTagAttempts', the chat's taggings), `tags` (the store of the tags
 * it got, by asset id) and `withTags(rows, byId)`. A photo with stored tags is never tagged here:
 * only Tag it on the photo and the album's Tags store AI tags on a photo.
 */
const chatTags = {
  run: (asset: VisionAsset, deps: VisionImageReadDeps) => attempts.run(asset.id, () => tagAsync(asset, deps)),
  once,
  tagMissingAsync,
  runningAttempt,
  attempts,
  tags,
  withTags,
};

export default chatTags;
