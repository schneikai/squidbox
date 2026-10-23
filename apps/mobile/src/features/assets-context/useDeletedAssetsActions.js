import useAssets from './useAssets';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import confirmAsync from '@/utils/confirmAsync';

/**
 * The Deleted album's actions on trashed assets, each behind its confirmation and run with progress:
 * `restore({ title, message, ids, onConfirm })` and `deletePermanently(…)`. `ids` is the asset ids,
 * or a function resolving them once confirmed; `onConfirm` runs right after (e.g. leave select mode).
 */
export default function useDeletedAssetsActions() {
  const { restoreDeletedAssets, deleteAssetsPermanently } = useAssets();
  const runWithProgress = useRunWithProgress();

  async function confirmThenRun(runAction, { ids, onConfirm, ...confirmOptions }) {
    if (!(await confirmAsync(confirmOptions))) return;
    const assetIds = typeof ids === 'function' ? await ids() : ids;
    onConfirm?.();
    runWithProgress((batchOptions) => runAction(assetIds, batchOptions));
  }

  return {
    restore: (options) => confirmThenRun(restoreDeletedAssets, { ...options, action: 'Restore' }),
    deletePermanently: (options) =>
      confirmThenRun(deleteAssetsPermanently, { ...options, action: 'Delete', destructive: true }),
  };
}
