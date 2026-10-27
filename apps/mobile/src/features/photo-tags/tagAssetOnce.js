import tagAssetFileAsync from './tagAssetFileAsync';
import tagAttempts from './tagAttempts';

/** Tags the asset by itself, unless it was tagged before in this app run (tagAssetAsync otherwise). */
export default function tagAssetOnce(asset, deps) {
  tagAttempts.once(asset.id, () => tagAssetFileAsync(asset, deps));
}
