import { Alert } from 'react-native';

import useProgressOverlay from './useProgressOverlay';

import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// What an action behind the overlay gets: the batch options the providers' bulk methods take.
export type ProgressOptions = {
  onProgress: (done: number, total: number, current?: number) => void;
  signal: AbortSignal;
};

// Resolves `false` when it stopped early; anything else is finished.
export type ProgressAction = (options: ProgressOptions) => Promise<unknown>;

export type RunWithProgress = (action: ProgressAction, options?: { failureTitle?: string }) => Promise<boolean>;

/**
 * Runs an action behind the progress overlay with a Cancel button: `run((options) => …, { failureTitle })`
 * passes `{ onProgress, signal }`, the batch options the providers' bulk methods take (see
 * writeInBatches). `onProgress(done, total, current)` moves the ring: `done` items finished plus
 * `current`, the running one's share (0–1). Cancel aborts `signal`: bulk writes stop between batches,
 * a download stops at once (rejecting with an `AbortError`). A failure, or a Cancel after some items,
 * is shown here with how many were done, so every caller gets it; resolves to whether the action
 * finished (the action resolves to `false` when it stopped early, as writeInBatches does).
 */
export default function useRunWithProgress(): RunWithProgress {
  const { show, hide, updateProgress } = useProgressOverlay();
  const haptics = useHaptics();

  return async function runWithProgress(action, { failureTitle = "Couldn't finish" } = {}) {
    const controller = new AbortController();
    let progress: Progress | null = null;
    const onProgress = (done: number, total: number, current = 0) => {
      progress = { done, total };
      updateProgress(((done + current) / total) * 100);
    };

    show({ onCancel: () => controller.abort() });
    let finished: unknown;
    try {
      finished = await action({ onProgress, signal: controller.signal });
    } catch (error) {
      if ((error as Error | null)?.name !== 'AbortError') {
        console.error('Action failed', error);
        const done = doneText(progress);
        const message = apiErrorMessage(error);
        haptics.error();
        Alert.alert(failureTitle, done ? `${message}\n\n${done} were done before that.` : message);
        return false;
      }
      finished = false;
    } finally {
      hide();
    }
    if (finished !== false) return true;

    // Cancelled: what came before stays done (batches commit one by one, files are saved one by one).
    const done = doneText(progress);
    if (done) Alert.alert('Stopped', `${done} done.`);
    return false;
  };
}

type Progress = { done: number; total: number };

function doneText(progress: Progress | null): string | null {
  return progress?.done ? `${progress.done} of ${progress.total}` : null;
}
