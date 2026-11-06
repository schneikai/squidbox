import type { CollectionTable, RowOf } from './clientCollections';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';

/** The rows of `table` with these ids (tombstones included) by id, read in one statement. */
export async function readByIdMap<T extends CollectionTable>(
  db: SyncDb,
  table: T,
  ids: string[],
): Promise<Map<string, RowOf<T>>> {
  if (ids.length === 0) return new Map();
  // drizzle types a select over a type parameter opaquely: the rows are the table's select model.
  const rows = (await db
    .select()
    .from(table)
    .where(inJson(table.id, [...new Set(ids)]))) as RowOf<T>[];
  return new Map(rows.map((row) => [row.id, row]));
}

/** The rows of `table` with these ids (tombstones included), once each, in `ids` order. */
export async function readByIds<T extends CollectionTable>(db: SyncDb, table: T, ids: string[]): Promise<RowOf<T>[]> {
  const byId = await readByIdMap(db, table, ids);
  return [...new Set(ids)].map((id) => byId.get(id)).filter((row) => row !== undefined);
}
