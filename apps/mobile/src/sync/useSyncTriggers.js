import { useEffect } from 'react';
import { AppState } from 'react-native';

import { requestSync } from './worker';

// Primary sync triggers (sync-design §8): on app foreground and on a plain in-app interval
// while foregrounded, plus on-mutation (providers call requestSync after each write). This is
// ordinary JS — the opportunistic background top-up (expo-background-task) is a later,
// device-gated addition.
//
// The LAUNCH pull is not fired here: App.js activates sync (setSyncActive) once init is done and
// someone is signed in, which kicks it. requestSync() is a no-op while inactive. That gate lives in
// the worker so every requestSync caller is covered at once.
const INTERVAL_MS = 30_000;

export default function useSyncTriggers() {
  useEffect(() => {
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
