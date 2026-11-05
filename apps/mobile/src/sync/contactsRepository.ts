import type { ContactRecord } from '@squidbox/shared';
import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';

const repository = makeRepository<ContactRecord>('contacts', schema.contacts);

// `remove` is a tombstone (deletedAt): the contact leaves every list, photo, album and post with it.
export const { create, update, remove, toggle } = repository;

// A live contact whose avatar file is on this device and not yet in the user's storage.
const unsyncedAvatar = and(
  isNotNull(schema.contacts.avatarFilename),
  eq(schema.contacts.isAvatarSynced, false),
  isNull(schema.contacts.deletedAt),
);

/** The ids of the contacts whose avatar waits for its upload, in id order: one backup run walks them. */
export async function readUnsyncedAvatarIds(db: SyncDb): Promise<string[]> {
  const rows = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(unsyncedAvatar)
    .orderBy(asc(schema.contacts.id));
  return rows.map((row) => row.id);
}

/** How many avatars wait for their upload. */
export async function readUnsyncedAvatarCount(db: SyncDb): Promise<number> {
  const [row] = await db.select({ count: count() }).from(schema.contacts).where(unsyncedAvatar);
  return row?.count ?? 0;
}

/**
 * Marks the contact's avatar uploaded, as one `(avatarFilename, isAvatarSynced)` group write, unless
 * the contact was deleted or got another photo meanwhile (`avatarFilename` is the one uploaded).
 * Resolves whether it marked it.
 */
export async function markAvatarSynced(db: SyncDb, id: string, avatarFilename: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await readByIds<schema.ContactRow>(tx, schema.contacts, [id]);
    if (!row || row.deletedAt !== null || row.avatarFilename !== avatarFilename || row.isAvatarSynced) return false;
    await repository.update(tx, id, { avatarFilename, isAvatarSynced: true });
    return true;
  });
}
