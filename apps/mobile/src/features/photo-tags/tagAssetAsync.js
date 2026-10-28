import tagAssetFileAsync from './tagAssetFileAsync';
import tagAttempts from './tagAttempts';

/**
 * Tags the asset (POST /ai/tags on its thumbnail; a video's is its frame) and stores the tags on it,
 * replacing any it had; resolves to the stored list, and fails when the photo was deleted meanwhile.
 * `before` (optional) runs first, as part of the tagging (a draft's flush, say). A tagging of the
 * asset already under way is joined rather than sent again, and every screen sees it (tagAttempts).
 * Once started it runs to its end and lands on the row, whoever still waits for it. `deps` are
 * readVisionImageAsync's (useVisionImageDeps).
 */
export default function tagAssetAsync(asset, deps, { before } = {}) {
  return tagAttempts.run(asset.id, async () => {
    await before?.();
    return tagAssetFileAsync(asset, deps);
  });
}
