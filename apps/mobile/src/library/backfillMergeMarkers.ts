import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { databaseExists } from './fs';
import { libraryPaths } from './libraryPaths';
import { getRegistry } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getKeptFor, getMergeTarget, setKeptFor, setMergeTarget } from '@/sync/status';

const DONE_KEY = 'mergeMarkersBackfilled';

// The installed build (df33378) recorded a device library's merge markers (`keptFor`, `mergedInto`)
// in the library list only (its markers take their account as the list loads, registry.ts); this
// build takes them from the library's own database (mergeRun.ts), which a list rebuilt from the
// databases restores them from (rebuildRegistry). Once, at the first boot of this build, before any
// merge runs, the list's markers are copied into each existing database that lacks them, so a list
// lost later can't let a kept library join a second account. Until a run completes, every boot tries.
export async function backfillMergeMarkers(): Promise<void> {
  if (await AsyncStorage.getItem(DONE_KEY)) return;
  let complete = true;
  for (const { id, keptFor, mergedInto } of getRegistry().libraries) {
    const { dbName } = libraryPaths(id);
    if ((!keptFor && !mergedInto) || !(await databaseExists(dbName))) continue; // never created here
    try {
      await withAppDb(dbName, async (db) => {
        if (keptFor && !(await getKeptFor(db))) await setKeptFor(db, keptFor);
        else if (!keptFor && mergedInto && !(await getMergeTarget(db))) await setMergeTarget(db, mergedInto);
      });
    } catch (error) {
      complete = false;
      Sentry.captureException(error); // never stops the boot; the next one tries again
    }
  }
  if (complete) await AsyncStorage.setItem(DONE_KEY, '1');
}
