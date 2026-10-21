import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { listDatabaseNames } from './fs';
import { libraryPaths } from './libraryPaths';
import { getRegistry } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getKeptFor, getMergeTarget, setKeptFor, setMergeAccount, setMergeTarget } from '@/sync/status';

const DONE_KEY = 'mergeMarkersBackfilled';

// The installed build (df33378) recorded a device library's merge markers (`keptFor`, `mergedInto`)
// in the library list only; this build takes them from the library's own database (mergeRun.ts),
// which a list rebuilt from the databases restores them from (rebuildRegistry). Once, at the first
// boot of this build, before any merge runs, the list's markers are copied into each existing
// database that lacks them (with the account a merge marker's library belongs to), so a list lost
// later can't let a kept library join a second account. Until a run completes, every boot tries.
export async function backfillMergeMarkers(): Promise<void> {
  if (await AsyncStorage.getItem(DONE_KEY)) return;
  const { libraries } = getRegistry();
  const marked = libraries.filter(({ keptFor, mergedInto }) => keptFor || mergedInto);
  const existing = marked.length > 0 ? await listDatabaseNames() : [];
  let complete = true;
  for (const { id, keptFor, mergedInto } of marked) {
    const { dbName } = libraryPaths(id);
    if (!existing.includes(dbName)) continue; // never created here
    const target = libraries.find((library) => library.id === mergedInto);
    try {
      await withAppDb(dbName, async (db) => {
        if (keptFor && !(await getKeptFor(db))) await setKeptFor(db, keptFor);
        if (keptFor || !mergedInto || (await getMergeTarget(db))) return;
        await setMergeTarget(db, mergedInto);
        if (target?.owner.kind === 'account') await setMergeAccount(db, target.owner);
      });
    } catch (error) {
      complete = false;
      Sentry.captureException(error); // never stops the boot; the next one tries again
    }
  }
  if (complete) await AsyncStorage.setItem(DONE_KEY, '1');
}
