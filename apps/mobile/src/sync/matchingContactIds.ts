import { isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { matchingIds } from './matchingIds';

/**
 * The ids of the live contacts whose name contains `searchText`, matched as `matchingIds` does: what
 * a photo or album search finds its tagged contacts by, one fold per contact.
 */
export async function matchingContactIds(tx: SyncDb, searchText: string): Promise<string[]> {
  const rows = await tx
    .select({ id: schema.contacts.id, text: schema.contacts.name })
    .from(schema.contacts)
    .where(isNull(schema.contacts.deletedAt));
  return matchingIds(rows, searchText);
}
