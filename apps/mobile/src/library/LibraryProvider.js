import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import LibraryContext from './LibraryContext';
import { bootLibrary } from './bootLibrary';
import { openLibraryEntry, openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { onRegistryChange } from './registry';
import { runPendingMerges, watchTokenDrops } from './sessionLibrary';
import { switchLibrary as performSwitch } from './switchLibrary';

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
      runPendingMerges().catch((resumeError) => console.warn('Could not resume a merge', resumeError));
    }, setError);
  }, [switchLibrary]);

  // From the boot on, a session that loses its tokens anywhere opens the library for it.
  useEffect(() => (booted ? watchTokenDrops(switchLibrary) : undefined), [booted, switchLibrary]);

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
        // The previous library couldn't be reopened either: with none open the gate would render
        // nothing, so the boot error asks for a restart (which opens the session's library again).
        if (!openLibraryId()) setError(switchError);
      },
    );
  }, [next]);

  // `paths`: the open library's folders and database name. Everything below LibraryGate is keyed by
  // the library, so paths read at render belong to that library for the component's whole life.
  const library = next ? null : openLibrary;
  const paths = useMemo(() => (library ? { id: library.id, ...libraryPaths(library.id) } : null), [library?.id]);
  const value = useMemo(
    () => ({
      library,
      paths,
      switching: next !== null,
      switchLibrary,
      booted,
    }),
    [library, paths, next, switchLibrary, booted],
  );

  if (error) throw error; // a database that won't open or migrate: BootErrorBoundary
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
