import useAssets from './useAssets';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import type { BatchOptions } from '@/sync/writeInBatches';
import confirmAsync from '@/utils/confirmAsync';

/**
 * The Deleted album's actions on trashed assets, each behind its confirmation and run with progress:
 * `restore({ title, message, ids, onConfirm })` and `deletePermanently(…)`. `ids` is the asset ids,
 * or a function resolving them once confirmed; `onConfirm` runs right after (e.g. leave select mode).
 */
// `ids` is a list, or a function that resolves it once confirmed: typed as it is.
type DeletedAssetsAction = {
  title: string;
  message?: string;
  ids: string[] | (() => Promise<string[]>);
  onConfirm?: () => void;
};

export default function useDeletedAssetsActions() {
  const { restoreDeletedAssets, deleteAssetsPermanently } = useAssets();
  const runWithProgress = useRunWithProgress();

  async function confirmThenRun(
    runAction: (assetIds: string[], batchOptions: BatchOptions) => Promise<boolean>,
    { ids, onConfirm, ...confirmOptions }: DeletedAssetsAction & { action: string; destructive?: boolean },
  ) {
    if (!(await confirmAsync(confirmOptions))) return;
    const assetIds = typeof ids === 'function' ? await ids() : ids;
    onConfirm?.();
    runWithProgress((batchOptions) => runAction(assetIds, batchOptions));
  }

  return {
    restore: (options: DeletedAssetsAction) => confirmThenRun(restoreDeletedAssets, { ...options, action: 'Restore' }),
    deletePermanently: (options: DeletedAssetsAction) =>
      confirmThenRun(deleteAssetsPermanently, { ...options, action: 'Delete', destructive: true }),
  };
}
