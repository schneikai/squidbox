import { Alert } from 'react-native';

import useProgressOverlay from './useProgressOverlay';

/**
 * Runs a bulk action behind the progress overlay with a Cancel button: `run((batchOptions) => …)`
 * passes the `{ onProgress, isCancelled }` the providers' bulk methods take (see writeInBatches), so
 * the ring follows the batches and Cancel stops after the running one. A failure is shown here, so
 * every caller gets it; resolves to whether the action finished.
 */
export default function useRunWithProgress() {
  const { show, hide, updateProgress } = useProgressOverlay();

  return async function runWithProgress(action) {
    let isCancelled = false;
    show({ onCancel: () => (isCancelled = true) });
    try {
      await action({
        onProgress: (done, total) => updateProgress((done / total) * 100),
        isCancelled: () => isCancelled,
      });
      return true;
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
