import { useCallback, useSyncExternalStore } from 'react';

import tagAssetAsync from './tagAssetAsync';
import tagAttempts from './tagAttempts';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import type { VisionAsset } from '@/utils/assets/readVisionImageAsync';

/**
 * Tagging the asset anew from a screen: `retag(before)` runs `before` first (a draft's flush, say),
 * then tags it and resolves to the stored tags, or to null once it failed. `isRunning` and `error`
 * are the asset's tagging wherever it started (tagAttempts; not the post chat's own, which
 * it never stores). A success or a failure is felt.
 */
export default function useRetag(asset: VisionAsset) {
  const haptics = useHaptics();
  const deps = useVisionImageDeps();
  const attempt = useSyncExternalStore(
    tagAttempts.subscribe,
    useCallback(() => tagAttempts.get()[asset.id], [asset.id]),
  );

  async function retag(before?: () => Promise<unknown>) {
    try {
      const tags = await tagAssetAsync(asset, deps, { before });
      haptics.success();
      return tags;
    } catch {
      haptics.error();
      return null;
    }
  }

  return {
    retag,
    isRunning: attempt?.status === 'loading',
    error: attempt?.status === 'error' ? attempt.error : null,
  };
}
