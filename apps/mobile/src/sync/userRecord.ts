/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any per-user collection's table */
import { collectionsByName } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextVersion } from './clock';
import type { SyncDb } from './db/types';
import { saveRecords } from './saveRecords';

import newRecord from '@/utils/newRecord';

type UserRecord = { id: string; updatedAt: number; deletedAt: number | null };

/**
 * Save what the user changed (`changes`) in a collection that holds one record per user, whose id is
 * the user's id, so every device writes the same record (personas, instructions). The first save
 * creates it over `empty`, later ones update it; a tombstoned one (say, reset on the server) comes
 * back with the changes rather than being inserted again. Only the changed fields get a new clock,
 * also on the first save, so a field the user didn't touch never overwrites another device's edit of
 * it, even when that edit hasn't been pulled yet.
 */
export async function saveUserRecord<F extends object>(
  db: SyncDb,
  collection: string,
  table: SQLiteTable,
  userId: string,
  changes: Partial<F>,
  empty: F,
): Promise<void> {
  const changed = Object.keys(changes);
  if (changed.length === 0) return;
  await db.transaction(async (tx) => {
    const id = (table as any).id;
    const [stored] = (await tx.select().from(table).where(eq(id, userId))) as UserRecord[];
    if (stored) {
      const revived = stored.deletedAt === null ? changes : { ...changes, deletedAt: null };
      await saveRecords(tx, collection, table, [nextVersion<UserRecord>(stored, revived)], { previous: [stored] });
      return;
    }
    const record = newRecord(collectionsByName[collection], empty, { ...changes, id: userId });
    const clocks = Object.fromEntries(changed.map((field) => [field, record.updatedAt]));
    await saveRecords(tx, collection, table, [record], { clocks: new Map([[userId, clocks]]) });
  });
}
