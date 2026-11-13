import useAssets from './useAssets';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import type { BatchOptions } from '@/sync/writeInBatches';
import confirmAsync from '@/utils/confirmAsync';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';

type DeletedAssetsTarget = { ids: string[] | (() => Promise<string[]>); onConfirm?: () => void };

/**
 * The Deleted album's actions on trashed assets, each behind its confirmation and run with progress:
 * `restore({ title, message, ids, onConfirm })` and `deletePermanently({ name, ids, onConfirm })`
 * ("Delete <name>?", saying it can't be undone). `ids` is the asset ids, or a function resolving them
 * once confirmed; `onConfirm` runs right after (e.g. leave select mode).
 */
export default function useDeletedAssetsActions() {
  const { restoreDeletedAssets, deleteAssetsPermanently } = useAssets();
  const runWithProgress = useRunWithProgress();

  async function confirmThenRun(
    runAction: (assetIds: string[], batchOptions: BatchOptions) => Promise<boolean>,
    confirm: () => Promise<boolean>,
    { ids, onConfirm }: DeletedAssetsTarget,
  ) {
    if (!(await confirm())) return;
    const assetIds = typeof ids === 'function' ? await ids() : ids;
    onConfirm?.();
    runWithProgress((batchOptions) => runAction(assetIds, batchOptions));
  }

  return {
    restore: ({ title, message, ...target }: DeletedAssetsTarget & { title: string; message: string }) =>
      confirmThenRun(restoreDeletedAssets, () => confirmAsync({ title, message, action: 'Restore' }), target),
    deletePermanently: ({ name, ...target }: DeletedAssetsTarget & { name: string }) =>
      confirmThenRun(deleteAssetsPermanently, () => confirmDeleteAsync({ name, also: "It can't be undone." }), target),
  };
}
