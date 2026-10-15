import { useCallback, useEffect, useMemo, useState } from 'react';

import LibraryContext from './LibraryContext';
import { bootLibrary } from './bootLibrary';
import { openLibraryId } from './current';
import { resumeMerges } from './mergeRun';
import { getRegistry, onRegistryChange } from './registry';
import { switchLibrary as performSwitch } from './switchLibrary';

import { navigateToTab } from '@/navigators/navigationRef';
import { withSyncPaused } from '@/sync/worker';

// The libraries on this device and the open one. Boots at mount (bootLibrary.ts): the session's
// library opens while the cloud init runs. A switch sets `next`: LibraryGate (App.js) then shows
// the switching screen, so everything below unmounts and its effects clean up, and the effect here
// runs the switch after those cleanups, in the same commit; the gate remounts the app under the
// new library's id. `booted` turns true once the boot, cloud init included, is through.
export default function LibraryProvider({ children }) {
  const [libraries, setLibraries] = useState([]);
  const [openId, setOpenId] = useState(null);
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
    const unsubscribe = onRegistryChange((registry) => setLibraries(registry.libraries));
    bootLibrary(switchLibrary).then(() => {
      setBooted(true);
      // A merge a crash interrupted finishes now, serialized with every switch; a failure waits for
      // the next boot.
      withSyncPaused(resumeMerges).catch((resumeError) => console.warn('Could not resume a merge', resumeError));
    }, setError);
    return unsubscribe;
  }, [switchLibrary]);

  useEffect(() => {
    if (!next) return;
    const firstOpen = openLibraryId() === null; // the boot's open, not a switch
    performSwitch(next.target).then(
      () => {
        setLibraries(getRegistry().libraries);
        setOpenId(openLibraryId());
        setNext(null);
        next.resolve();
        // The remount reset the navigation; a switch always ends in Settings.
        if (!firstOpen) navigateToTab('SettingsTab');
      },
      (switchError) => {
        setOpenId(openLibraryId());
        setNext(null);
        next.reject(switchError);
      },
    );
  }, [next]);

  const value = useMemo(() => {
    const library = next || openId === null ? null : (libraries.find(({ id }) => id === openId) ?? null);
    return { library, libraries, switching: next?.target ?? null, switchLibrary, booted };
  }, [libraries, openId, next, switchLibrary, booted]);

  if (error) throw error; // a database that won't open or migrate: BootErrorBoundary
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
