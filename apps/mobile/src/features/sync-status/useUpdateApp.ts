import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';

/**
 * The update gate's Update action (docs/sync-design.md §15): `update()` fetches this build's newest
 * EAS update and restarts into it. Where there is none, or updates are off (a dev client, the web),
 * or the fetch fails, an error haptic and one alert say to install the latest version (never the
 * check's own error, which speaks to developers). `updating` is true while it runs, for the
 * button's `loading`.
 */
export default function useUpdateApp() {
  const haptics = useHaptics();
  const [updating, setUpdating] = useState(false);

  async function update() {
    setUpdating(true);
    try {
      if (await fetchUpdate()) {
        await Updates.reloadAsync();
        return;
      }
    } catch (error) {
      console.warn('Could not update the app', error);
    } finally {
      setUpdating(false);
    }
    haptics.error();
    Alert.alert("Couldn't update", 'Install the latest version of Squidbox, then open it again.');
  }

  return { update, updating };
}

// Whether a newer update was fetched; false where updates are off or there is none.
async function fetchUpdate(): Promise<boolean> {
  if (!Updates.isEnabled) return false;
  if (!(await Updates.checkForUpdateAsync()).isAvailable) return false;
  return (await Updates.fetchUpdateAsync()).isNew;
}
