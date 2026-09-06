import { useEffect } from 'react';
import { AppState } from 'react-native';

import { requestSync } from './worker';

// Primary sync triggers (sync-design §8): on app foreground and on a plain in-app interval
// while foregrounded, plus on-mutation (providers call requestSync after each write). This is
// ordinary JS — the opportunistic background top-up (expo-background-task) is a later,
// device-gated addition. Mounted once from AppComponent (after the DB has migrated).
const INTERVAL_MS = 30_000;

export default function useSyncTriggers() {
  useEffect(() => {
    requestSync(); // initial catch-up on launch
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') requestSync();
    }, INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);
}
