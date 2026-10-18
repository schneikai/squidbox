import { Alert } from 'react-native';

import useAssets from './useAssets';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';

/**
 * The Deleted album's actions on trashed assets, each behind its confirmation and run with progress:
 * `restore({ title, message, ids, onConfirm })` and `deletePermanently(…)`. `ids` is the asset ids,
 * or a function resolving them once confirmed; `onConfirm` runs right after (e.g. leave select mode).
 */
export default function useDeletedAssetsActions() {
  const { restoreDeletedAssets, deleteAssetsPermanently } = useAssets();
  const runWithProgress = useRunWithProgress();

  function confirm(action, actionLabel, { title, message, ids, onConfirm }) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: actionLabel,
        onPress: async () => {
          const assetIds = typeof ids === 'function' ? await ids() : ids;
          onConfirm?.();
          runWithProgress((batchOptions) => action(assetIds, batchOptions));
        },
      },
    ]);
  }

  return {
    restore: (options) => confirm(restoreDeletedAssets, 'Restore', options),
    deletePermanently: (options) => confirm(deleteAssetsPermanently, 'Delete', options),
  };
}
