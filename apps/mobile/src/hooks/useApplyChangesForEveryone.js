import useConfirmedRun from '@/hooks/useConfirmedRun';

/**
 * Apply changes for everyone, the same for every screen that publishes for every account:
 * `publish(message, run)` and `isPublishing`, useConfirmedRun's `run` and `isRunning`.
 */
export default function useApplyChangesForEveryone() {
  const { isRunning, run } = useConfirmedRun({
    title: 'Apply changes for everyone?',
    action: 'Apply changes for everyone',
    errorTitle: "Couldn't apply the changes for everyone",
  });
  return { isPublishing: isRunning, publish: run };
}
