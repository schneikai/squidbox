import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as lists from '../src/sync/contactListsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';

describe('contactsRepository', () => {
  let db: SyncDb;
  let n: number;
  const newId = () => `edge-${++n}`;
  const PHOTO = { targetType: 'asset', targetId: 'photo-1' };

  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000); // every write in one millisecond, as on a fast phone
    db = makeTestDb();
    n = 0;
    await contacts.create(db, makeContactRecord({ id: 'maya', name: 'Maya' }));
    for (const id of ['hikes', 'climbs'])
      await lists.create(db, { id, name: id, notes: null, createdAt: 1, updatedAt: 1, deletedAt: null });
  });

  afterEach(() => vi.restoreAllMocks());

  const live = async () => [
    ...(await db.select().from(schema.contactListMembers))
      .filter((e) => e.deletedAt === null)
      .map((e) => `list ${e.listId}`),
    ...(await db.select().from(schema.contactLinks))
      .filter((e) => e.deletedAt === null)
      .map((e) => `${e.targetType} ${e.targetId}`),
  ];

  it('restoring a deleted contact puts it back in its lists and on its photos', async () => {
    await contactListMembers.add(db, { listId: 'hikes' }, ['maya'], newId);
    await contactLinks.add(db, PHOTO, ['maya'], newId);

    await contacts.deleteContact(db, 'maya');
    expect(await live()).toEqual([]);
    await contacts.restore(db, 'maya');

    expect(await live()).toEqual(['list hikes', 'asset photo-1']);
    expect((await db.select().from(schema.contacts))[0]!.deletedAt).toBeNull();
  });

  it('restoring brings back only what the deletion took, and no list deleted since', async () => {
    await contactListMembers.add(db, { listId: 'hikes' }, ['maya'], newId);
    await contactListMembers.add(db, { listId: 'climbs' }, ['maya'], newId);
    await contactLinks.add(db, PHOTO, ['maya'], newId);
    await contactLinks.remove(db, PHOTO, ['maya']); // untagged before the delete

    await contacts.deleteContact(db, 'maya');
    await lists.remove(db, ['climbs']);
    await contacts.restore(db, 'maya');

    expect(await live()).toEqual(['list hikes']);
  });
});
