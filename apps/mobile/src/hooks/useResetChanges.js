import useConfirmedRun from '@/hooks/useConfirmedRun';

/**
 * Reset changes, the same for every screen that goes back to the app's defaults: `reset(message,
 * run)` and `isResetting`, useConfirmedRun's `run` and `isRunning`.
 */
export default function useResetChanges() {
  const { isRunning, run } = useConfirmedRun({
    title: 'Reset changes?',
    action: 'Reset',
    destructive: true,
    errorTitle: "Couldn't reset the changes",
  });
  return { isResetting: isRunning, reset: run };
}
