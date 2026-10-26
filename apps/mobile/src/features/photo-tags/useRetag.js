import { useState } from 'react';

import tagAssetAsync from './tagAssetAsync';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * Tagging the asset anew from a screen: `retag(before)` runs `before` first (a draft's flush, say),
 * then tags it and resolves to the stored tags, or to null once it failed, with `error` saying why.
 * `isRunning` from the start of `before` to the end. A success or a failure is felt.
 */
export default function useRetag(asset) {
  const haptics = useHaptics();
  const deps = useVisionImageDeps();
  const [state, setState] = useState({ isRunning: false, error: null });

  async function retag(before) {
    setState({ isRunning: true, error: null });
    try {
      await before?.();
      const tags = await tagAssetAsync(asset, deps);
      setState({ isRunning: false, error: null });
      haptics.success();
      return tags;
    } catch (error) {
      setState({ isRunning: false, error: apiErrorMessage(error) });
      haptics.error();
      return null;
    }
  }

  return { retag, isRunning: state.isRunning, error: state.error };
}
