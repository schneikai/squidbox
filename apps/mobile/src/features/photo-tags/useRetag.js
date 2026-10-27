import { useCallback, useSyncExternalStore } from 'react';

import tagAssetAsync from './tagAssetAsync';
import tagAttempts from './tagAttempts';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';

/**
 * Tagging the asset anew from a screen: `retag(before)` runs `before` first (a draft's flush, say),
 * then tags it and resolves to the stored tags, or to null once it failed. `isRunning` and `error`
 * are the asset's tagging wherever it started (tagAttempts: the chat's too). A success or a failure
 * is felt.
 */
export default function useRetag(asset) {
  const haptics = useHaptics();
  const deps = useVisionImageDeps();
  const attempt = useSyncExternalStore(
    tagAttempts.subscribe,
    useCallback(() => tagAttempts.get()[asset.id], [asset.id]),
  );

  async function retag(before) {
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
