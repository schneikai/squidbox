/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextVersion, tombstone } from './clock';
import type { SyncDb } from './db/types';
import { chunk } from './pushPlan';
import { saveRecords } from './saveRecords';

type SyncRecord = { id: string; updatedAt: number; deletedAt: number | null } & Record<string, any>;

const READ_BATCH = 500;

// Repository for a syncable collection (assets, albums, posts). Every write is one transaction that
// stores the records and their coalesced outbox rows, with the monotonic clock.
export function makeRepository<R extends SyncRecord = SyncRecord>(collection: string, table: SQLiteTable) {
  async function readByIds(tx: SyncDb, ids: string[]): Promise<R[]> {
    const rows: R[] = [];
    for (const batch of chunk(ids, READ_BATCH)) {
      const found = await tx
        .select()
        .from(table)
        .where(inArray((table as any).id, batch));
      rows.push(...(found as R[]));
    }
    return rows;
  }

  async function createMany(db: SyncDb, records: R[]): Promise<R[]> {
    const rows = records.map((record) => nextVersion(record));
    await db.transaction((tx) => saveRecords(tx, collection, table, rows));
    return rows;
  }

  /** Patch records, by id. Ids without a row are skipped. */
  async function updateMany(db: SyncDb, changesById: Record<string, Partial<R>>): Promise<void> {
    await db.transaction(async (tx) => {
      const rows = (await readByIds(tx, Object.keys(changesById))).map((prev) =>
        nextVersion(prev, changesById[prev.id]),
      );
      await saveRecords(tx, collection, table, rows);
    });
  }

  return {
    createMany,
    async create(db: SyncDb, record: R): Promise<R> {
      const [created] = await createMany(db, [record]);
      return created!;
    },
    updateMany,
    update(db: SyncDb, id: string, changes: Partial<R>): Promise<void> {
      return updateMany(db, { [id]: changes } as Record<string, Partial<R>>);
    },
    /** Tombstone records, by id. */
    async remove(db: SyncDb, ids: string[]): Promise<void> {
      await db.transaction(async (tx) => {
        await saveRecords(tx, collection, table, (await readByIds(tx, ids)).map(tombstone));
      });
    },
  };
}
