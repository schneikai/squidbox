import { describe, it, expect, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import albumQuery from '../src/features/album-list/albumQuery';
import assetQuery from '../src/features/asset-list/assetQuery';
import contactListQuery from '../src/features/contact-list/contactListQuery';
import contactQuery from '../src/features/contact-list/contactQuery';
import pinnedList from '../src/features/contact-list/pinnedList';
import * as assets from '../src/sync/assetsRepository';
import * as lists from '../src/sync/contactListsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';
import { makeRepository } from '../src/sync/repository';
import { upsertRows } from '../src/sync/upsertRows';

let db: SyncDb;
let n: number;
const newId = () => `edge-${++n}`;

beforeEach(async () => {
  db = makeTestDb();
  n = 0;
  await contacts.create(
    db,
    makeContactRecord({
      id: 'maya',
      name: 'Maya',
      places: [{ city: 'Squamish', state: 'British Columbia', country: 'Canada' }],
    }),
  );
  await contacts.create(db, makeContactRecord({ id: 'ben', name: 'ben', xHandle: 'benclimbs' }));
  await contacts.create(
    db,
    makeContactRecord({ id: 'ana', name: 'Ana', isFavorite: true, favoritedAt: 5, blueskyHandle: 'ana.bsky.social' }),
  );
});

const ids = (query: ReturnType<typeof contactQuery>) => query.ids(db);

describe('contactQuery', () => {
  it('lists the live contacts by name, ignoring case', async () => {
    await contacts.create(db, makeContactRecord({ id: 'gone', name: 'Zed', deletedAt: 9 }));
    expect(await ids(contactQuery({}))).toEqual(['ana', 'ben', 'maya']);
    expect((await contactQuery({}).read(db, { limit: 2 })).count).toBe(3);
  });

  it('sorts by when a contact was added, newest first', async () => {
    await contacts.create(db, makeContactRecord({ id: 'zoe', name: 'Zoe', createdAt: 3 }));
    await contacts.create(db, makeContactRecord({ id: 'bea', name: 'Bea', createdAt: 2 }));
    expect(await ids(contactQuery({ sort: 'createdAt:desc' }))).toEqual(['zoe', 'bea', 'ana', 'ben', 'maya']);
  });

  it('in a list, recently added sorts by when the contact joined the list', async () => {
    await upsertRows(db, 'contact_list_members', schema.contactListMembers, [
      { id: 'e1', createdAt: 5, updatedAt: 5, deletedAt: null, listId: 'l1', contactId: 'maya' },
      { id: 'e2', createdAt: 4, updatedAt: 4, deletedAt: null, listId: 'l1', contactId: 'ben' },
      { id: 'e3', createdAt: 6, updatedAt: 6, deletedAt: null, listId: 'l1', contactId: 'ana' },
      // Another list's edge doesn't count.
      { id: 'e4', createdAt: 8, updatedAt: 8, deletedAt: null, listId: 'l2', contactId: 'ben' },
    ]);
    expect(await ids(contactQuery({ scope: { listId: 'l1' }, sort: 'createdAt:desc' }))).toEqual([
      'ana',
      'maya',
      'ben',
    ]);
  });

  it('in a list, a contact added again sorts by when it was added again', async () => {
    await upsertRows(db, 'contact_list_members', schema.contactListMembers, [
      { id: 'e1', createdAt: 5, updatedAt: 5, deletedAt: null, listId: 'l1', contactId: 'maya' },
      { id: 'e2', createdAt: 6, updatedAt: 6, deletedAt: null, listId: 'l1', contactId: 'ana' },
    ]);
    await contactListMembers.add(db, { listId: 'l1' }, ['ben'], newId);
    await contactListMembers.remove(db, { listId: 'l1' }, ['maya']);
    await contactListMembers.add(db, { listId: 'l1' }, ['maya'], newId);
    expect(await ids(contactQuery({ scope: { listId: 'l1' }, sort: 'createdAt:desc' }))).toEqual([
      'maya',
      'ben',
      'ana',
    ]);
  });

  it('lists the favorites by when they were favorited, newest first', async () => {
    await contacts.update(db, 'maya', { isFavorite: true, favoritedAt: 9 });
    expect(await ids(contactQuery({ scope: 'favorites' }))).toEqual(['maya', 'ana']);
  });

  it('search finds a contact by a place or a handle', async () => {
    expect(await ids(contactQuery({ search: 'squam' }))).toEqual(['maya']);
    expect(await ids(contactQuery({ search: 'british columbia' }))).toEqual(['maya']);
    expect(await ids(contactQuery({ search: 'BENCLIMBS' }))).toEqual(['ben']);
  });

  it("a list's scope is its live members", async () => {
    await contactListMembers.add(db, { listId: 'l1' }, ['maya', 'ben'], newId);
    await contactListMembers.remove(db, { listId: 'l1' }, ['ben']);
    expect(await ids(contactQuery({ scope: { listId: 'l1' } }))).toEqual(['maya']);
  });

  it('a deleted contact leaves the photo it was on', async () => {
    const target = { targetType: 'asset' as const, targetId: 'a1' };
    await contactLinks.add(db, target, ['maya', 'ana'], newId);
    await contacts.remove(db, ['maya']);
    expect(await ids(contactQuery({ scope: target }))).toEqual(['ana']);
  });
});

describe("a contact's photos and albums", () => {
  it('a deleted photo is hidden from the contact it was on', async () => {
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'a2' })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya'], newId);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a2' }, ['maya'], newId);
    await assets.remove(db, ['a2']);
    expect(await assetQuery({ scope: { contactId: 'maya' } }).ids(db)).toEqual(['a1']);
  });

  it("the album scope is the albums the contact is on, not another's", async () => {
    await contactLinks.add(db, { targetType: 'album', targetId: 'al1' }, ['maya'], newId);
    await contactLinks.add(db, { targetType: 'album', targetId: 'al2' }, ['ben'], newId);
    const albums = makeRepository('albums', schema.albums);
    await albums.createMany(db, [makeAlbumRecord({ id: 'al1' }), makeAlbumRecord({ id: 'al2' })]);
    const rows = await albumQuery({ scope: { contactId: 'maya' } }).read(db);
    expect(rows.map((row: { id: string }) => row.id)).toEqual(['al1']);
  });
});

describe('contactListQuery', () => {
  it('counts the live members once each and stacks the first three by name', async () => {
    const list = await lists.create(db, {
      id: 'l1',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      name: 'Squamish',
      notes: null,
    });
    await contacts.create(db, makeContactRecord({ id: 'cleo', name: 'Cleo' }));
    await contactListMembers.add(db, { listId: list.id }, ['maya', 'ben', 'ana', 'cleo'], newId);
    await contacts.remove(db, ['cleo']);
    // A second live edge of one pair (two devices added her at once) counts once.
    await upsertRows(db, 'contact_list_members', schema.contactListMembers, [
      { id: 'twin', createdAt: 2, updatedAt: 2, deletedAt: null, listId: list.id, contactId: 'ana' },
    ]);
    const [row] = await contactListQuery().read(db);
    expect(row!.memberCount).toBe(3);
    expect(row!.firstMembers.map((m: { id: string }) => m.id)).toEqual(['ana', 'ben', 'maya']);
    const [counted] = await contactListQuery({ withMembers: false }).read(db);
    expect(counted).toMatchObject({ id: 'l1', memberCount: 3 });
    expect(counted).not.toHaveProperty('firstMembers');
  });
});

describe('pinned list', () => {
  const makeList = (id: string, fields: Partial<schema.ContactListRow> = {}) =>
    lists.create(db, { id, createdAt: 1, updatedAt: 1, deletedAt: null, name: id, notes: null, ...fields });
  const pinnedId = async () => pinnedList(await contactListQuery({ withMembers: false }).read(db))?.id ?? null;

  it('pinning a list unpins the one pinned before, and pinning Favorites unpins every list', async () => {
    await makeList('hiking');
    await makeList('brands');
    await lists.pin(db, 'hiking');
    await lists.pin(db, 'brands');
    expect(await pinnedId()).toBe('brands');
    expect((await db.select().from(schema.contactLists)).filter((l) => l.pinnedAt != null)).toHaveLength(1);
    await lists.pin(db, null);
    expect(await pinnedId()).toBeNull();
  });

  it('shows the list pinned last when two devices pinned one each, and Favorites once it is deleted', async () => {
    await makeList('hiking', { pinnedAt: 10 });
    await makeList('brands', { pinnedAt: 20 });
    expect(await pinnedId()).toBe('brands');
    await lists.remove(db, ['brands']);
    expect(await pinnedId()).toBe('hiking');
    await lists.remove(db, ['hiking']);
    expect(await pinnedId()).toBeNull();
  });
});
