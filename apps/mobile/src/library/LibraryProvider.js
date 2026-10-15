import { useCallback, useEffect, useMemo, useState } from 'react';

import LibraryContext from './LibraryContext';
import { getLibrary, isLibraryOpen } from './current';
import { resumeMerges } from './mergeRun';
import { openBootLibrary } from './openBootLibrary';
import { getRegistry, onRegistryChange } from './registry';
import { switchLibrary as performSwitch } from './switchLibrary';

import { navigateToTab } from '@/navigators/navigationRef';

// The libraries on this device and the open one. Opens the boot library at mount, alongside the
// cloud init below it. A switch sets `next`: LibraryGate (App.js) then shows the switching screen,
// so everything below unmounts and its effects clean up, and the effect here runs the switch after
// those cleanups, in the same commit; the gate remounts the app under the new library's id.
export default function LibraryProvider({ children }) {
  const [libraries, setLibraries] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onRegistryChange((registry) => setLibraries(registry.libraries));
    openBootLibrary().then(() => {
      setLibraries(getRegistry().libraries);
      setOpenId(getLibrary().id);
      // A merge a crash interrupted finishes in the background; a failure waits for the next boot.
      resumeMerges().catch((resumeError) => console.warn('Could not resume a merge', resumeError));
    }, setError);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!next) return;
    performSwitch(next.target).then(
      () => {
        setOpenId(getLibrary().id);
        setNext(null);
        next.resolve();
        // The remount reset the navigation; the switch always ends in Settings.
        navigateToTab('SettingsTab');
      },
      (switchError) => {
        setOpenId(isLibraryOpen() ? getLibrary().id : null);
        setNext(null);
        next.reject(switchError);
      },
    );
  }, [next]);

  // Resolves once the target is open (or rejects with the previous library open again). Call it
  // inside withSyncPaused, together with the session change it belongs to.
  const switchLibrary = useCallback(
    (target) => new Promise((resolve, reject) => setNext({ target, resolve, reject })),
    [],
  );

  const value = useMemo(() => {
    const library = next || openId === null ? null : (libraries.find(({ id }) => id === openId) ?? null);
    return { library, libraries, switching: next?.target ?? null, switchLibrary };
  }, [libraries, openId, next, switchLibrary]);

  if (error) throw error; // a database that won't open or migrate: BootErrorBoundary
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
