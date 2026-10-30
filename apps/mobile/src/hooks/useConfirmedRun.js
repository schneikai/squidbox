import { useState } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * A confirmed action, like Apply changes for everyone or Reset changes: `run(message, fn)` confirms
 * with `title`, `message` and `action` (`destructive` in red), then runs `fn`, with a success
 * haptic, or an error haptic and an alert titled `errorTitle` with the reason. `message` may be an
 * async function, for a confirm that reads what it names first; a failing read alerts the same way.
 * `isRunning` is true while either runs, for the button's `loading`, which blocks a second tap.
 */
export default function useConfirmedRun({ title, action, destructive = false, errorTitle }) {
  const haptics = useHaptics();
  const [isRunning, setIsRunning] = useState(false);

  function fail(error) {
    haptics.error();
    Alert.alert(errorTitle, apiErrorMessage(error));
  }

  async function readMessage(message) {
    if (typeof message !== 'function') return message;
    setIsRunning(true);
    try {
      return await message();
    } finally {
      setIsRunning(false);
    }
  }

  async function run(message, fn) {
    let text;
    try {
      text = await readMessage(message);
    } catch (error) {
      fail(error);
      return;
    }
    if (!(await confirmAsync({ title, message: text, action, destructive }))) return;
    setIsRunning(true);
    try {
      await fn();
      haptics.success();
    } catch (error) {
      fail(error);
    } finally {
      setIsRunning(false);
    }
  }

  return { isRunning, run };
}
