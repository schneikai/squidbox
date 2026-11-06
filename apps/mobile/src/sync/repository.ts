import type { CollectionTable, InsertOf, RowOf } from './clientCollections';
import { nextVersion, tombstone } from './clock';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { saveRecords } from './saveRecords';

// Repository for a syncable collection (assets, albums, posts). Every write is one transaction that
// stores the records and their coalesced outbox rows, with the monotonic clock.
export function makeRepository<T extends CollectionTable>(collection: string, table: T) {
  type Row = RowOf<T>;
  type Insert = InsertOf<T>;

  async function createMany<R extends Insert>(db: SyncDb, records: R[]): Promise<R[]> {
    const rows = records.map((record) => nextVersion(record));
    await db.transaction((tx) => saveRecords(tx, collection, table, rows, { isNew: true }));
    return rows;
  }

  /** Patch records, by id. Ids without a row are skipped. */
  async function updateMany(db: SyncDb, changesById: Record<string, Partial<Row>>): Promise<void> {
    await db.transaction(async (tx) => {
      const previous = await readByIds(tx, table, Object.keys(changesById));
      const rows = previous.map((prev) => nextVersion(prev, changesById[prev.id]));
      await saveRecords(tx, collection, table, rows, { previous });
    });
  }

  return {
    createMany,
    async create<R extends Insert>(db: SyncDb, record: R): Promise<R> {
      const [created] = await createMany(db, [record]);
      return created!;
    },
    updateMany,
    update(db: SyncDb, id: string, changes: Partial<Row>): Promise<void> {
      return updateMany(db, { [id]: changes });
    },
    /** The same patch for several records. */
    updateAll(db: SyncDb, ids: string[], changes: Partial<Row>): Promise<void> {
      return updateMany(db, Object.fromEntries(ids.map((id) => [id, changes])));
    },
    /**
     * Flip a boolean field, read inside the write's transaction so two quick toggles can't both flip the
     * same value. `derive(row)` gives fields that follow from the flipped row.
     */
    async toggle(
      db: SyncDb,
      id: string,
      field: keyof Row & string,
      derive?: (row: Row) => Partial<Row>,
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const [prev] = await readByIds(tx, table, [id]);
        if (!prev) return;
        const row = nextVersion(prev, { [field]: !prev[field] } as Partial<Row>);
        await saveRecords(tx, collection, table, [{ ...row, ...derive?.(row) }], { previous: [prev] });
      });
    },
    /** Tombstone records, by id. */
    async remove(db: SyncDb, ids: string[]): Promise<void> {
      await db.transaction(async (tx) => {
        const previous = await readByIds(tx, table, ids);
        await saveRecords(tx, collection, table, previous.map(tombstone), { previous });
      });
    },
  };
}
