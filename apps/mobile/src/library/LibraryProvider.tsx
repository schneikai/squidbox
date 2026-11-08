import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import LibraryContext, { type LibraryContextValue } from './LibraryContext';
import { bootLibrary } from './bootLibrary';
import { openLibraryEntry, openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { type Library, onRegistryChange } from './registry';
import { runPendingMerges, type SwitchLibrary, watchTokenDrops } from './sessionLibrary';
import { switchLibrary as performSwitch } from './switchLibrary';

type LibraryProviderProps = { children: ReactNode };

// A switch the effect below runs: its target, and the promise switchLibrary returned to settle.
type PendingSwitch = { target: Library; resolve: () => void; reject: (error: unknown) => void };

// The open library. A switch sets `next`: LibraryGate (app/_layout.tsx) then shows the switching screen, so
// everything below unmounts and its effects clean up, and the effect here runs the switch after
// those cleanups, in the same commit; the gate remounts the app under the new library's id.
export default function LibraryProvider({ children }: LibraryProviderProps) {
  const openLibrary = useSyncExternalStore(onRegistryChange, openLibraryEntry);
  const [next, setNext] = useState<PendingSwitch | null>(null);
  const [booted, setBooted] = useState(false);
  const bootDone = useRef(false); // for the switch effect, which the boot's own switches run through
  const [error, setError] = useState<unknown>(null);

  // Resolves once the target is open (or rejects with the previous library open again). Call it
  // inside withSyncPaused, together with the session change it belongs to.
  const switchLibrary = useCallback<SwitchLibrary>(
    (target) => new Promise((resolve, reject) => setNext({ target, resolve, reject })),
    [],
  );

  useEffect(() => {
    bootLibrary(switchLibrary).then(() => {
      bootDone.current = true;
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
        // With none open the gate would render nothing: the boot error, once booted (during the boot,
        // bootLibrary's fallback runs, and its rejection is the boot error).
        if (bootDone.current && !openLibraryId()) setError(switchError);
      },
    );
  }, [next]);

  // `paths`: the open library's folders and database name. Everything below LibraryGate is keyed by
  // the library, so paths read at render belong to that library for the component's whole life.
  const library = next ? null : openLibrary;
  const paths = useMemo<LibraryContextValue['paths']>(
    () => (library ? { id: library.id, ...libraryPaths(library.id) } : null),
    [library?.id],
  );
  const value = useMemo<LibraryContextValue>(
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
