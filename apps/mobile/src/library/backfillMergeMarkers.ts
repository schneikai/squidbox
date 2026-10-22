import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { databaseExists } from './fs';
import { libraryPaths } from './libraryPaths';
import type { MergeMarker } from './mergeMarker';
import { getRegistry, updateRegistry, type Library } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getKeptFor, getMergeTarget, setKeptFor, setMergeTarget } from '@/sync/status';

const DONE_KEY = 'mergeMarkersBackfilled';

// The installed build (df33378) recorded a device library's merge markers in the library list only,
// `mergedInto` as the target library's id; this build keeps the marker with its account
// (mergeMarker.ts) and takes the markers from the library's own database (mergeRun.ts), which a list
// rebuilt from the databases restores them from (rebuildRegistry). Once, at the first boot of this
// build, after resolveOwners and before any merge runs: the list's markers take the account of the
// library they name (and go when it is gone), then they are copied into each existing database that
// lacks them, so a list lost later can't let a kept library join a second account. Until a run
// completes, every boot tries.
export async function backfillMergeMarkers(): Promise<void> {
  if (await AsyncStorage.getItem(DONE_KEY)) return;
  await updateRegistry((registry) => {
    const libraries = registry.libraries.map((library) => withAccount(library, registry.libraries));
    return libraries.every((library, i) => library === registry.libraries[i]) ? registry : { libraries };
  });
  let complete = true;
  for (const { id, keptFor, mergedInto } of getRegistry().libraries) {
    const { dbName } = libraryPaths(id);
    if ((!keptFor && !mergedInto) || !(await databaseExists(dbName))) continue; // never created here
    try {
      await withAppDb(dbName, async (db) => {
        if (keptFor && !(await getKeptFor(db))) await setKeptFor(db, keptFor);
        else if (mergedInto && !(await getMergeTarget(db))) await setMergeTarget(db, mergedInto);
      });
    } catch (error) {
      complete = false;
      Sentry.captureException(error); // never stops the boot; the next one tries again
    }
  }
  if (complete) await AsyncStorage.setItem(DONE_KEY, '1');
}

// An id-only marker with the account of the library it names, none when that is gone. One whose owner
// is still unresolved (no serverId, resolveOwners) keeps it as its owner has it: while that library
// is listed, its merge resumes there (joinedElsewhere needs only the id for it).
function withAccount(library: Library, libraries: Library[]): Library {
  const marker = library.mergedInto as MergeMarker | string | undefined;
  if (typeof marker !== 'string') return library;
  const { mergedInto: _legacy, ...rest } = library;
  const owner = libraries.find(({ id }) => id === marker)?.owner;
  if (owner?.kind !== 'account') return rest;
  return { ...rest, mergedInto: { library: marker, serverId: owner.serverId, userId: owner.userId } };
}
