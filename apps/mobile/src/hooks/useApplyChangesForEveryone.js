import { useState } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Apply changes for everyone, the same for every screen that publishes for every account:
 * `publish(message, run)` confirms with `message`, then runs `run` (the publish), with a success
 * haptic, or an error haptic and an alert with the reason. `isPublishing` is true while `run` runs,
 * for the button's `loading`, which blocks a second tap.
 */
export default function useApplyChangesForEveryone() {
  const haptics = useHaptics();
  const [isPublishing, setIsPublishing] = useState(false);

  async function publish(message, run) {
    const isConfirmed = await confirmAsync({
      title: 'Apply changes for everyone?',
      message,
      action: 'Apply changes for everyone',
    });
    if (!isConfirmed) return;
    setIsPublishing(true);
    try {
      await run();
      haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't apply the changes for everyone", apiErrorMessage(error));
    } finally {
      setIsPublishing(false);
    }
  }

  return { isPublishing, publish };
}
