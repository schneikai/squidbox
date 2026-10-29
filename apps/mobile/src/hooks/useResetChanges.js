import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Reset changes, the same for every screen that goes back to the app's defaults:
 * `reset(message, run)` confirms with `message`, then runs `run`, with a success haptic, or an error
 * haptic and an alert with the reason.
 */
export default function useResetChanges() {
  const haptics = useHaptics();

  async function reset(message, run) {
    const isConfirmed = await confirmAsync({ title: 'Reset changes?', message, action: 'Reset', destructive: true });
    if (!isConfirmed) return;
    try {
      await run();
      haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't reset the changes", apiErrorMessage(error));
    }
  }

  return reset;
}
