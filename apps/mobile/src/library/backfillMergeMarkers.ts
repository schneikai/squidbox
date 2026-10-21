import * as Sentry from '@sentry/react-native';

import { libraryPaths } from './libraryPaths';
import { getRegistry } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getKeptFor, getMergeTarget, setKeptFor, setMergeTarget } from '@/sync/status';

// The installed build (df33378) recorded a device library's merge markers (`keptFor`, `mergedInto`)
// in the library list only; this build takes them from the library's own database (mergeRun.ts),
// which a list rebuilt from the databases restores them from (rebuildRegistry). At every boot, before
// any merge runs, the list's markers are copied into each database that lacks them, so a list lost
// later can't let a kept library join a second account. Idempotent.
export async function backfillMergeMarkers(): Promise<void> {
  for (const { id, keptFor, mergedInto } of getRegistry().libraries) {
    if (!keptFor && !mergedInto) continue;
    try {
      await withAppDb(libraryPaths(id).dbName, async (db) => {
        if (keptFor && !(await getKeptFor(db))) await setKeptFor(db, keptFor);
        else if (!keptFor && mergedInto && !(await getMergeTarget(db))) await setMergeTarget(db, mergedInto);
      });
    } catch (error) {
      Sentry.captureException(error); // never stops the boot; that library just keeps the list's word
    }
  }
}
