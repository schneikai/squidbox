import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, createThread, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import readMentionedContactPhotos from '../src/features/contact-mentions/readMentionedContactPhotos';
import * as assets from '../src/sync/assetsRepository';
import * as contacts from '../src/sync/contactsRepository';
import type { SyncDb } from '../src/sync/db/types';

let db: SyncDb;

const read = async () => {
  const { photosByContact, postCount } = await readMentionedContactPhotos(db);
  return { photos: Object.fromEntries([...photosByContact].map(([id, photos]) => [id, photos.sort()])), postCount };
};

beforeEach(async () => {
  db = makeTestDb();
  for (const id of ['p1', 'p2', 'p3']) await assets.create(db, makeAssetRecord({ id }));
  await contacts.create(db, makeContactRecord({ id: 'ben', xHandle: '@BenClimbs' }));
  await contacts.create(db, makeContactRecord({ id: 'ana', blueskyHandle: 'ana.bsky.social' }));
});

describe('readMentionedContactPhotos', () => {
  it("puts a contact a post mentions by any handle, without case, on that post's photos", async () => {
    await createPost(db, { text: 'Ridge run with @BenClimbs' }, ['p1', 'p2']);
    await createPost(db, { text: 'Coast with @ana.bsky.social' }, ['p3']);
    await createPost(db, { text: 'Nobody here, mail kai@example.com' }, ['p1']);
    expect(await read()).toEqual({ photos: { ben: ['p1', 'p2'], ana: ['p3'] }, postCount: 2 });
  });

  it('matches a Bluesky handle mentioned without .bsky.social', async () => {
    await createPost(db, { text: 'Thanks @ana!' }, ['p1']);
    expect((await read()).photos).toEqual({ ana: ['p1'] });
  });

  it('leaves out deleted posts, deleted contacts and trashed photos', async () => {
    await createPost(db, { text: '@benclimbs', deletedAt: 5 }, ['p1']);
    await createPost(db, { text: '@benclimbs again' }, ['p2', 'p3']);
    await assets.update(db, 'p3', { deletedAt: 5 });
    await createPost(db, { text: 'with @gone' }, ['p1']);
    await contacts.create(db, makeContactRecord({ id: 'gone', xHandle: 'gone', deletedAt: 5 }));
    expect(await read()).toEqual({ photos: { ben: ['p2'] }, postCount: 1 });
  });

  it("counts a thread once when its following post mentions the same handle, with that post's photos", async () => {
    await createThread(db, { id: 'post-1', text: 'Ridge run with @BenClimbs', assetIds: ['p1'] }, [
      { text: 'Full set with @benclimbs', assetIds: ['p2'] },
    ]);
    expect(await read()).toEqual({ photos: { ben: ['p1', 'p2'] }, postCount: 1 });
  });

  it("puts a chip's live contact on the post's photos, by the chip alone", async () => {
    await createPost(db, { text: 'Out with Ana', mentions: [{ contactId: 'ana', location: 9, name: 'Ana' }] }, ['p1']);
    await createPost(db, { text: 'And Gone', mentions: [{ contactId: 'gone', location: 4, name: 'Gone' }] }, ['p2']);
    expect(await read()).toEqual({ photos: { ana: ['p1'] }, postCount: 1 });
  });
});
