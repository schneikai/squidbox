import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// How the user set up their contacts (contact_settings): the only reader and writer of that table.
// One record per user, whose id is the user's id.

const t = schema.contactSettings;

export type ContactSettings = Pick<schema.ContactSettingRow, 'pinnedListId' | 'pinnedAt'>;

const EMPTY_SETTINGS: ContactSettings = Object.freeze({ pinnedListId: null, pinnedAt: null });

/** The user's contact settings, empty before the first save. */
export async function readContactSettings(db: SyncDb, userId: string): Promise<ContactSettings> {
  const [row] = await db
    .select({ pinnedListId: t.pinnedListId, pinnedAt: t.pinnedAt })
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return row ?? EMPTY_SETTINGS;
}

/**
 * Pins the built-in list `listId` to the top of Contacts now, or `favorites` for none (a list of the
 * user's is pinned on its own record): timestamped either way, so the latest pick wins over one
 * another device made before they synced. Picking what is already pinned writes nothing.
 */
export function pinBuiltInList(db: SyncDb, userId: string, listId: string): Promise<void> {
  return saveUserRecord(
    db,
    'contact_settings',
    t,
    userId,
    (stored): Partial<ContactSettings> =>
      stored?.pinnedListId === listId ? {} : { pinnedListId: listId, pinnedAt: Date.now() },
    EMPTY_SETTINGS,
  );
}
