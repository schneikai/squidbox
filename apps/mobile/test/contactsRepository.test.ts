import { describe, it, expect, beforeEach } from 'vitest';

import { makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { readByIds } from '../src/sync/readByIds';

describe('contactsRepository', () => {
  let db: SyncDb;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('readUnsyncedAvatarIds lists the live contacts whose avatar waits for its upload, in id order', async () => {
    await contacts.create(db, makeContactRecord({ id: 'c', avatarFilename: 'avatar-c-1.jpg' }));
    await contacts.create(db, makeContactRecord({ id: 'a', avatarFilename: 'avatar-a-1.jpg' }));
    await contacts.create(db, makeContactRecord({ id: 'b', avatarFilename: 'avatar-b-1.jpg', isAvatarSynced: true }));
    await contacts.create(db, makeContactRecord({ id: 'd' }));
    await contacts.create(db, makeContactRecord({ id: 'e', avatarFilename: 'avatar-e-1.jpg', deletedAt: 5 }));
    expect(await contacts.readUnsyncedAvatarIds(db)).toEqual(['a', 'c']);
    expect(await contacts.readUnsyncedAvatarCount(db)).toBe(2);
  });

  it('markAvatarSynced marks the uploaded avatar', async () => {
    await contacts.create(db, makeContactRecord({ id: 'a', avatarFilename: 'avatar-a-1.jpg' }));
    expect(await contacts.markAvatarSynced(db, 'a', 'avatar-a-1.jpg')).toBe(true);
    const [row] = await readByIds<schema.ContactRow>(db, schema.contacts, ['a']);
    expect(row!.isAvatarSynced).toBe(true);
  });

  it('markAvatarSynced writes nothing once the contact got another photo', async () => {
    await contacts.create(db, makeContactRecord({ id: 'a', avatarFilename: 'avatar-a-1.jpg' }));
    await contacts.update(db, 'a', { avatarFilename: 'avatar-a-2.jpg', isAvatarSynced: false });
    expect(await contacts.markAvatarSynced(db, 'a', 'avatar-a-1.jpg')).toBe(false);
    const [row] = await readByIds<schema.ContactRow>(db, schema.contacts, ['a']);
    expect(row).toMatchObject({ avatarFilename: 'avatar-a-2.jpg', isAvatarSynced: false });
  });
});
