import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import LibraryContext from './LibraryContext';
import { bootLibrary } from './bootLibrary';
import { openLibraryEntry } from './current';
import { resumeMerges } from './mergeRun';
import { onRegistryChange } from './registry';
import { mergeDeviceLibrary } from './sessionLibrary';
import { switchLibrary as performSwitch } from './switchLibrary';

import { withSyncPaused } from '@/sync/worker';

// The open library. A switch sets `next`: LibraryGate (App.js) then shows the switching screen, so
// everything below unmounts and its effects clean up, and the effect here runs the switch after
// those cleanups, in the same commit; the gate remounts the app under the new library's id.
export default function LibraryProvider({ children }) {
  const openLibrary = useSyncExternalStore(onRegistryChange, openLibraryEntry);
  const [next, setNext] = useState(null);
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState(null);

  // Resolves once the target is open (or rejects with the previous library open again). Call it
  // inside withSyncPaused, together with the session change it belongs to.
  const switchLibrary = useCallback(
    (target) => new Promise((resolve, reject) => setNext({ target, resolve, reject })),
    [],
  );

  useEffect(() => {
    bootLibrary(switchLibrary).then(() => {
      setBooted(true);
      // A merge a crash interrupted finishes now, and this device's library joins the account's if
      // it hasn't yet, serialized with every switch; a failure waits for the next boot.
      withSyncPaused(async () => {
        await resumeMerges();
        await mergeDeviceLibrary();
      }).catch((resumeError) => console.warn('Could not resume a merge', resumeError));
    }, setError);
  }, [switchLibrary]);

  useEffect(() => {
    if (!next) return;
    performSwitch(next.target).then(
      () => {
        setNext(null);
        next.resolve();
      },
      (switchError) => {
        setNext(null);
        next.reject(switchError);
      },
    );
  }, [next]);

  const value = useMemo(
    () => ({ library: next ? null : openLibrary, switching: next !== null, switchLibrary, booted }),
    [openLibrary, next, switchLibrary, booted],
  );

  if (error) throw error; // a database that won't open or migrate: BootErrorBoundary
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
