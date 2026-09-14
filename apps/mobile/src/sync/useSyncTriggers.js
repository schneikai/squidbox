import { useEffect } from 'react';
import { AppState } from 'react-native';

import { requestSync } from './worker';

// Primary sync triggers (sync-design §8): on app foreground and on a plain in-app interval
// while foregrounded, plus on-mutation (providers call requestSync after each write). This is
// ordinary JS — the opportunistic background top-up (expo-background-task) is a later,
// device-gated addition.
//
// `enabled` gates the triggers on app-init being DONE. Critical: if the heavy first-sync starts on
// mount, it competes with init's awaited DB work (the account-switch reset), starves it, and init
// never returns → the splash never lifts (only happens when a big first-sync is in flight; an
// already-synced device pulls 0 rows and never contends). So the sync must not start until init has
// finished — after that, initializeCloud's own post-login requestSync kicks it off cleanly.
const INTERVAL_MS = 30_000;

export default function useSyncTriggers(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    requestSync(); // initial catch-up, once init is done
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
  }, [enabled]);
}
