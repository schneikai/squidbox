import { useState } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import { updateApp } from '@/lib/updateApp';

/**
 * The update gate's Update action: `update()` fetches the newest EAS update and restarts into it
 * (updateApp). Where none can be fetched, or the fetch fails, an error haptic and an alert say to
 * install the latest version. `updating` is true while it runs, for the button's `loading`.
 */
export default function useUpdateApp() {
  const haptics = useHaptics();
  const [updating, setUpdating] = useState(false);

  async function update() {
    setUpdating(true);
    try {
      if ((await updateApp()) === 'restarting') return;
      fail();
    } catch (error) {
      console.warn('Could not update the app', error);
      fail();
    } finally {
      setUpdating(false);
    }
  }

  function fail() {
    haptics.error();
    Alert.alert("Couldn't update", 'Install the latest version of Squidbox, then open it again.');
  }

  return { update, updating };
}
