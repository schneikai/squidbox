/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextVersion, tombstone } from './clock';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { saveRecords } from './saveRecords';

type SyncRecord = { id: string; updatedAt: number; deletedAt: number | null } & Record<string, any>;

// Repository for a syncable collection (assets, albums, posts). Every write is one transaction that
// stores the records and their coalesced outbox rows, with the monotonic clock.
export function makeRepository<R extends SyncRecord = SyncRecord>(collection: string, table: SQLiteTable) {
  async function createMany(db: SyncDb, records: R[]): Promise<R[]> {
    const rows = records.map((record) => nextVersion(record));
    await db.transaction((tx) => saveRecords(tx, collection, table, rows, { isNew: true }));
    return rows;
  }

  /** Patch records, by id. Ids without a row are skipped. */
  async function updateMany(db: SyncDb, changesById: Record<string, Partial<R>>): Promise<void> {
    await db.transaction(async (tx) => {
      const previous = await readByIds<R>(tx, table, Object.keys(changesById));
      const rows = previous.map((prev) => nextVersion(prev, changesById[prev.id]));
      await saveRecords(tx, collection, table, rows, { previous });
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
    /** The same patch for several records. */
    updateAll(db: SyncDb, ids: string[], changes: Partial<R>): Promise<void> {
      return updateMany(db, Object.fromEntries(ids.map((id) => [id, changes])) as Record<string, Partial<R>>);
    },
    /**
     * Flip a boolean field, read inside the write's transaction so two quick toggles can't both flip the
     * same value. `derive(row)` gives fields that follow from the flipped row.
     */
    async toggle(db: SyncDb, id: string, field: keyof R & string, derive?: (row: R) => Partial<R>): Promise<void> {
      await db.transaction(async (tx) => {
        const [prev] = await readByIds<R>(tx, table, [id]);
        if (!prev) return;
        const row = nextVersion(prev, { [field]: !prev[field] } as Partial<R>);
        await saveRecords(tx, collection, table, [{ ...row, ...derive?.(row) }], { previous: [prev] });
      });
    },
    /** Tombstone records, by id. */
    async remove(db: SyncDb, ids: string[]): Promise<void> {
      await db.transaction(async (tx) => {
        const previous = await readByIds<R>(tx, table, ids);
        await saveRecords(tx, collection, table, previous.map(tombstone), { previous });
      });
    },
  };
}
