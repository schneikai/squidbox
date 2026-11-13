import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { EMPTY_PLACE } from '../src/features/contact-detail/contactFields';
import pinnedList from '../src/features/contact-list/pinnedList';
import type { PhotosOf } from '../src/sync/assetSql';
import * as assets from '../src/sync/assetsRepository';
import * as lists from '../src/sync/contactListsRepository';
import { readContactSettings } from '../src/sync/contactSettingsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';
import albumQuery from '../src/sync/queries/albumQuery';
import assetQuery from '../src/sync/queries/assetQuery';
import contactListQuery from '../src/sync/queries/contactListQuery';
import contactQuery from '../src/sync/queries/contactQuery';
import postQuery from '../src/sync/queries/postQuery';
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
  it('withLists names the live lists each contact is in, by name', async () => {
    const list = (id: string, name: string, deletedAt: number | null = null) =>
      lists.create(db, { id, createdAt: 1, updatedAt: 1, deletedAt, name, notes: null });
    await list('l1', 'Print buyers');
    await list('l2', 'hiking crew');
    await list('l3', 'Gone', 5);
    await contactListMembers.addToEach(db, [{ listId: 'l1' }, { listId: 'l2' }, { listId: 'l3' }], ['maya'], newId);
    const { rows } = await contactQuery({ withLists: true }).read(db);
    expect(Object.fromEntries(rows.map((row) => [row.id, row.listNames]))).toEqual({
      ana: [],
      ben: [],
      maya: ['hiking crew', 'Print buyers'],
    });
  });

  it('withLists names Tagged for a contact on a photo still there, by name with its lists, but not inside Tagged', async () => {
    await lists.create(db, { id: 'l1', createdAt: 1, updatedAt: 1, deletedAt: null, name: 'Zine', notes: null });
    await contactListMembers.addToEach(db, [{ listId: 'l1' }], ['maya'], newId);
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'gone', deletedAt: 5 })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya', 'ana'], newId);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'gone' }, ['ben'], newId);
    const names = async (scope: 'all' | 'tagged') =>
      Object.fromEntries(
        (await contactQuery({ scope, withLists: true }).read(db)).rows.map((r) => [r.id, r.listNames]),
      );
    expect(await names('all')).toEqual({ ana: ['Tagged'], ben: [], maya: ['Tagged', 'Zine'] });
    expect(await names('tagged')).toEqual({ ana: [], maya: ['Zine'] });
  });

  it('Tagged lists the contacts on any photo still there, once each', async () => {
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'gone', deletedAt: 5 })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya', 'ana'], newId);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya'], newId);
    // Only on a deleted photo: not tagged.
    await contactLinks.add(db, { targetType: 'asset', targetId: 'gone' }, ['ben'], newId);
    expect(await ids(contactQuery({ scope: 'tagged' }))).toEqual(['ana', 'maya']);
  });

  it('filters narrow the contacts to those every filter holds for, in the chosen sort', async () => {
    await contacts.create(db, makeContactRecord({ id: 'zoe', name: 'Zoe', isFavorite: true, favoritedAt: 9 }));
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['zoe', 'maya'], newId);
    expect(await ids(contactQuery({ filter: ['favorites'] }))).toEqual(['ana', 'zoe']);
    expect(await ids(contactQuery({ filter: ['tagged'] }))).toEqual(['maya', 'zoe']);
    expect(await ids(contactQuery({ filter: ['favorites', 'tagged'] }))).toEqual(['zoe']);
    expect(await ids(contactQuery({ filter: ['favorites'], search: 'an' }))).toEqual(['ana']);
  });

  it('Deleted lists only the deleted contacts, the latest deleted first, until one is restored', async () => {
    await contacts.create(db, makeContactRecord({ id: 'old', name: 'Old', deletedAt: 5 }));
    await contacts.create(db, makeContactRecord({ id: 'new', name: 'New', deletedAt: 9 }));
    expect(await ids(contactQuery({ scope: 'deleted' }))).toEqual(['new', 'old']);
    await contacts.update(db, 'new', { deletedAt: null });
    expect(await ids(contactQuery({ scope: 'deleted' }))).toEqual(['old']);
    expect(await ids(contactQuery({}))).toContain('new');
  });

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

  it('search finds a handle typed as a handle field takes it: with @ or as a profile URL', async () => {
    expect(await ids(contactQuery({ search: '@BenClimbs ' }))).toEqual(['ben']);
    expect(await ids(contactQuery({ search: 'https://x.com/BenClimbs?s=21' }))).toEqual(['ben']);
  });

  it('search finds a handle stored with @ and capitals under any spelling', async () => {
    await contacts.create(db, makeContactRecord({ id: 'todo', name: 'Todo', xHandle: '@TodoesMorb0' }));
    for (const search of ['todoesmorb0', '@todoesmorb0', 'x.com/TodoesMorb0'])
      expect(await ids(contactQuery({ search }))).toEqual(['todo']);
  });

  it("a pasted link that isn't a profile finds no contact by its first segment", async () => {
    await contacts.create(db, makeContactRecord({ id: 'eye', name: 'Eye', xHandle: 'i' }));
    expect(await ids(contactQuery({ search: 'https://x.com/i/lists/1' }))).toEqual([]);
  });

  it('search ignores accents both ways', async () => {
    await contacts.create(
      db,
      makeContactRecord({ id: 'joao', name: 'João', places: [{ ...EMPTY_PLACE, city: 'São Paulo' }] }),
    );
    await contacts.create(db, makeContactRecord({ id: 'rene', name: 'Rene' }));
    expect(await ids(contactQuery({ search: 'sao' }))).toEqual(['joao']);
    expect(await ids(contactQuery({ search: 'JOAO' }))).toEqual(['joao']);
    expect(await ids(contactQuery({ search: 'René' }))).toEqual(['rene']);
  });

  it('search matches umlauts and ß by either spelling', async () => {
    await contacts.create(
      db,
      makeContactRecord({ id: 'mueller', name: 'Jörg Müller', places: [{ ...EMPTY_PLACE, city: 'Gießen' }] }),
    );
    await contacts.create(db, makeContactRecord({ id: 'schroeder', name: 'Schroeder' }));
    expect(await ids(contactQuery({ search: 'muller' }))).toEqual(['mueller']);
    expect(await ids(contactQuery({ search: 'Mueller' }))).toEqual(['mueller']);
    expect(await ids(contactQuery({ search: 'giessen' }))).toEqual(['mueller']);
    expect(await ids(contactQuery({ search: 'schröder' }))).toEqual(['schroeder']);
  });

  it("a list's scope is its live members", async () => {
    await contactListMembers.add(db, { listId: 'l1' }, ['maya', 'ben'], newId);
    await contactListMembers.remove(db, { listId: 'l1' }, ['ben']);
    expect(await ids(contactQuery({ scope: { listId: 'l1' } }))).toEqual(['maya']);
  });

  it('a deleted contact leaves the photo it was on', async () => {
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya', 'ana'], newId);
    await contacts.remove(db, ['maya']);
    expect(await ids(contactQuery({ scope: { photoIds: ['a1'] } }))).toEqual(['ana']);
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

  it("a contact's albums and posts include those holding a photo it is on, not a trashed one, and they list it", async () => {
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'a2' })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['maya'], newId);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a2' }, ['maya'], newId);
    await assets.remove(db, ['a2']);
    const albums = makeRepository('albums', schema.albums);
    await albums.createMany(db, [makeAlbumRecord({ id: 'al1' }), makeAlbumRecord({ id: 'al2' })]);
    const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
    await albumEdges.createFromRefs(db, 'al1', [{ id: 'ae1', assetId: 'a1' }]);
    await albumEdges.createFromRefs(db, 'al2', [{ id: 'ae2', assetId: 'a2' }]);
    await createPost(db, { id: 'p1' }, ['a1']);
    await createPost(db, { id: 'p2' }, ['a2']);
    const rows = await albumQuery({ scope: { contactId: 'maya' } }).read(db);
    expect(rows.map((row: { id: string }) => row.id)).toEqual(['al1']);
    expect((await postQuery({ scope: { contactId: 'maya' } }).read(db)).rows.map((row) => row.id)).toEqual(['p1']);
    const listed = async (photosOf: PhotosOf) => contactQuery({ scope: { photosOf } }).ids(db);
    expect([await listed({ albumId: 'al1' }), await listed({ postId: 'p1' })]).toEqual([['maya'], ['maya']]);
    expect([await listed({ albumId: 'al2' }), await listed({ postId: 'p2' })]).toEqual([[], []]);
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
    expect(row).toMatchObject({ memberCount: 3, firstMembers: [{ id: 'ana' }, { id: 'ben' }, { id: 'maya' }] });
    const [counted] = await contactListQuery({ withMembers: false }).read(db);
    expect(counted).toMatchObject({ id: 'l1', memberCount: 3 });
    expect(counted).not.toHaveProperty('firstMembers');
  });
});

describe('pinned list', () => {
  const USER_ID = '00000000-0000-4000-8000-000000000001';
  const makeList = (id: string, fields: Partial<schema.ContactListRow> = {}) =>
    lists.create(db, { id, createdAt: 1, updatedAt: 1, deletedAt: null, name: id, notes: null, ...fields });
  const pinnedId = async () =>
    pinnedList(await contactListQuery({ withMembers: false }).read(db), await readContactSettings(db, USER_ID))?.id ??
    null;

  it('pinning a list unpins the one pinned before, and pinning Favorites unpins every list', async () => {
    await makeList('hiking');
    await makeList('brands');
    await lists.pin(db, { listId: 'hiking' }, USER_ID);
    await lists.pin(db, { listId: 'brands' }, USER_ID);
    expect(await pinnedId()).toBe('brands');
    expect((await db.select().from(schema.contactLists)).filter((l) => l.pinnedAt != null)).toHaveLength(1);
    await lists.pin(db, null, USER_ID);
    expect(await pinnedId()).toBeNull();
  });

  it('pins Tagged in the contact settings, in place of a pinned list, and a list in place of it', async () => {
    await makeList('hiking');
    await lists.pin(db, { listId: 'hiking' }, USER_ID);
    await lists.pin(db, { builtInId: 'tagged' }, USER_ID);
    expect(await pinnedId()).toBe('tagged');
    expect((await db.select().from(schema.contactLists)).filter((l) => l.pinnedAt != null)).toHaveLength(0);
    await lists.pin(db, { listId: 'hiking' }, USER_ID);
    expect(await pinnedId()).toBe('hiking');
    // Pinning the list already pinned again changes nothing.
    await lists.pin(db, { listId: 'hiking' }, USER_ID);
    expect(await pinnedId()).toBe('hiking');
  });

  it('shows Favorites when it was picked after another device pinned Tagged', () => {
    expect(pinnedList([], { pinnedListId: 'tagged', pinnedAt: 20 })?.id).toBe('tagged');
    expect(
      pinnedList([{ id: 'hiking', name: 'hiking', pinnedAt: 10 }], { pinnedListId: 'favorites', pinnedAt: 30 }),
    ).toBeNull();
  });

  it('shows Tagged or a list, whichever two devices pinned last', async () => {
    await makeList('hiking', { pinnedAt: 10 });
    expect(
      pinnedList([{ id: 'hiking', name: 'hiking', pinnedAt: 10 }], { pinnedListId: 'tagged', pinnedAt: 20 })?.id,
    ).toBe('tagged');
    expect(
      pinnedList([{ id: 'hiking', name: 'hiking', pinnedAt: 30 }], { pinnedListId: 'tagged', pinnedAt: 20 })?.id,
    ).toBe('hiking');
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
