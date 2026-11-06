import tagAssetFileAsync, { type TagDeps } from './tagAssetFileAsync';
import tagAttempts from './tagAttempts';

import type { VisionAsset } from '@/utils/assets/readVisionImageAsync';

/** Tags the asset by itself, unless it was tagged before in this app run (tagAssetAsync otherwise). */
export default function tagAssetOnce(asset: VisionAsset, deps: TagDeps): void {
  tagAttempts.once(asset.id, () => tagAssetFileAsync(asset, deps));
}
