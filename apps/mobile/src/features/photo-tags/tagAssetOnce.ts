import tagAssetFileAsync from './tagAssetFileAsync';
import tagAttempts from './tagAttempts';

import type { VisionAsset, VisionImageReadDeps } from '@/utils/assets/readVisionImageAsync';

/** Tags the asset by itself, unless it was tagged before in this app run (tagAssetAsync otherwise). */
export default function tagAssetOnce(asset: VisionAsset, deps: VisionImageReadDeps): void {
  tagAttempts.once(asset.id, () => tagAssetFileAsync(asset, deps));
}
