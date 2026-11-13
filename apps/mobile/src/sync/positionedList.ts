import { keyBetween, movePositions } from '@squidbox/shared';
import { asc, desc, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveRecords } from './saveRecords';

// A synced list whose every live row has a position (a fractional-index key), ordered by
// `(position, id)`: the prompt buttons and the user's channels. Albums stay out
// (providers/albums/moveAlbum): an album's position is nullable (albums without one come first), and a
// move under another sort re-keys the whole list (positionsInOrder).

/** A table of such a list. */
type PositionedTable = typeof schema.promptButtons | typeof schema.channels;

/** The live rows of `table`, in their order. */
export async function readInOrder<T extends PositionedTable>(db: SyncDb, table: T): Promise<T['$inferSelect'][]> {
  // drizzle types a select over a type parameter opaquely: the rows are the table's select model.
  return (await db
    .select()
    .from(table)
    .where(isNull(table.deletedAt))
    .orderBy(asc(table.position), asc(table.id))) as T['$inferSelect'][];
}

/** The key after the last live row of `table`. */
export async function positionAtEnd(db: SyncDb, table: PositionedTable): Promise<string> {
  const [last] = await db
    .select({ position: table.position })
    .from(table)
    .where(isNull(table.deletedAt))
    .orderBy(desc(table.position), desc(table.id))
    .limit(1);
  return keyBetween(last?.position ?? null, null);
}

/**
 * Move a row of `collection` right after `afterId` (`null`: first), with one new position between
 * its new neighbours as the database has them (movePositions). Nothing when either is gone.
 */
export async function moveInList(
  db: SyncDb,
  collection: string,
  table: PositionedTable,
  id: string,
  afterId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const live = await readInOrder(tx, table);
    if (!live.some((row) => row.id === id)) return;
    const updates = movePositions(live, id, afterId);
    const changed = live.filter((row) => updates[row.id]).map((row) => nextVersion(row, updates[row.id]));
    await saveRecords(tx, collection, table, changed, { previous: live });
  });
}
