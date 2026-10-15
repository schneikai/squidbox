import { Alert } from 'react-native';

import useProgressOverlay from './useProgressOverlay';

/**
 * Runs a bulk action behind the progress overlay with a Cancel button: `run((batchOptions) => …)`
 * passes the `{ onProgress, isCancelled }` the providers' bulk methods take (see writeInBatches), so
 * the ring follows the batches and Cancel stops after the running one. A failure or a Cancel is
 * shown here, so every caller gets it; resolves to whether the action finished (the action resolves
 * to `false` when it stopped early, as writeInBatches does).
 */
export default function useRunWithProgress() {
  const { show, hide, updateProgress } = useProgressOverlay();

  return async function runWithProgress(action) {
    let isCancelled = false;
    let progress = null;
    show({ onCancel: () => (isCancelled = true) });
    try {
      const finished = await action({
        onProgress: (done, total) => {
          progress = { done, total };
          updateProgress((done / total) * 100);
        },
        isCancelled: () => isCancelled,
      });
      if (finished !== false) return true;
      // Cancelled between batches: what committed stays, so say how far it got.
      Alert.alert('Stopped', progress ? `${progress.done} of ${progress.total} done.` : 'Nothing was changed.');
      return false;
    } catch (error) {
      console.error('Bulk action failed', error);
      // Batches commit one by one, so what came before the failure stays done.
      Alert.alert("Couldn't finish", `Part of it may already be done.\n${error.message}`);
      return false;
    } finally {
      hide();
    }
  };
}
