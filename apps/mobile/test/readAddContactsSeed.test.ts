import { beforeEach, describe, expect, it } from 'vitest';

import { makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import readAddContactsSeed from '../src/features/contact-picker/readAddContactsSeed';
import * as assets from '../src/sync/assetsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks } from '../src/sync/membershipRepository';
import { makeRepository } from '../src/sync/repository';

let db: SyncDb;
let n: number;
const newId = () => `edge-${++n}`;
const tag = (assetId: string, contactIds: string[]) =>
  contactLinks.add(db, { targetType: 'asset', targetId: assetId }, contactIds, newId);

beforeEach(async () => {
  db = makeTestDb();
  n = 0;
  for (const [id, name] of [
    ['maya', 'Maya'],
    ['ben', 'Ben'],
    ['cleo', 'Cleo'],
  ])
    await contacts.create(db, makeContactRecord({ id, name }));
  await assets.createMany(
    db,
    ['a1', 'a2', 'a3', 'a4'].map((id) => makeAssetRecord({ id })),
  );
  // The album Squamish holds a1 and a2.
  await makeRepository('albums', schema.albums).createMany(db, [makeAlbumRecord({ id: 'al1', name: 'Squamish' })]);
  await makeEdgeRepository('album_assets', schema.albumAssets, 'albumId').createFromRefs(db, 'al1', [
    { id: 'ae1', assetId: 'a1' },
    { id: 'ae2', assetId: 'a2' },
  ]);
});

describe('readAddContactsSeed', () => {
  it("an album's contacts are those on its photos, those on only some of them partial", async () => {
    await tag('a1', ['maya', 'ben']);
    await tag('a2', ['maya']);
    await tag('a3', ['cleo']);
    const seed = await readAddContactsSeed(db, { albumId: 'al1' });
    expect(seed).toMatchObject({ subtitle: '2 photos', partial: ['ben'] });
    expect([...(seed?.linked ?? [])].sort()).toEqual(['ben', 'maya']);
  });

  it('a photo offers the contacts on the photos of each album it is in', async () => {
    await tag('a2', ['cleo']);
    await tag('a4', ['ben']);
    const seed = await readAddContactsSeed(db, { assetId: 'a1' });
    expect(seed).toMatchObject({ linked: [], related: [{ title: 'Also in Squamish', ids: ['cleo'] }] });
  });
});
