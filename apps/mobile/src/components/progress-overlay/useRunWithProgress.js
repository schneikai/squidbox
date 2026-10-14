import useProgressOverlay from './useProgressOverlay';

/**
 * Runs a bulk action behind the progress overlay with a Cancel button: `run((batchOptions) => …)`
 * passes the `{ onProgress, isCancelled }` the providers' bulk methods take (see writeInBatches), so
 * the ring follows the batches and Cancel stops after the running one.
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
    } finally {
      hide();
    }
  };
}
