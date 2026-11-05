import type { PushMutation } from '@squidbox/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { makeMeasuredTestDb, makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import * as contactLists from '../src/sync/contactListsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';
import { countOutbox, retryFailures } from '../src/sync/outbox';
import { readPushFailures } from '../src/sync/readPushFailures';
import { readUploadFailures } from '../src/sync/readUploadFailures';
import { makeRepository } from '../src/sync/repository';
import { retryFailuresAndSync, runSyncOnce, setSyncTarget, withSyncPaused, type SyncTarget } from '../src/sync/worker';

// The production wrapper's file uploads need the native file system; these runs name no file.
vi.mock('../src/sync/fileUploads', () => ({ fileUploader: () => async () => {} }));

const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

// A server that rejects the mutations of `rejected` collections and applies the rest; `pushed` lists
// every mutation it got.
function server(rejected: string[] = []) {
  const pushed: PushMutation[] = [];
  const transport = fakeTransport({
    push: async ({ mutations }) => {
      pushed.push(...mutations);
      return {
        results: mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          ...(rejected.includes(m.collection)
            ? { status: 'rejected' as const, reason: 'schema:name' }
            : { status: 'applied' as const }),
        })),
      };
    },
  });
  return { transport, pushed };
}

const outboxRows = () => db.select().from(schema.outbox);
const failures = async () => (await readPushFailures(db, { limit: 50 })).rows;

describe('push failures of albums, posts and edges', () => {
  it('a rejected album push is recorded on its outbox row, read with its name and link and not pushed again', async () => {
    const album = await albums.create(db, makeAlbumRecord({ name: 'Trips' }));
    const rejecting = server(['albums']);
    await runSyncOnce(db, rejecting.transport);

    expect(await outboxRows()).toMatchObject([{ recordId: album.id, error: 'schema:name' }]);
    expect(await readPushFailures(db, { limit: 50 })).toEqual({
      rows: [{ id: expect.any(Number), title: 'Album "Trips"', error: 'schema:name', href: `/album/${album.id}` }],
      count: 1,
    });
    const [log] = await db.select().from(schema.syncLog);
    expect(log?.notes).toContain(`albums ${album.id}: rejected (schema:name)`);

    await runSyncOnce(db, rejecting.transport);
    expect(rejecting.pushed).toHaveLength(1); // the same payload would fail the same way
  });

  it('a new edit of the record pushes it again, and its success clears the failure', async () => {
    const album = await albums.create(db, makeAlbumRecord({ name: 'Trips' }));
    await runSyncOnce(db, server(['albums']).transport);
    await albums.update(db, album.id, { name: 'Trips 2024' });
    expect(await outboxRows()).toMatchObject([{ error: null }]);

    const applying = server();
    await runSyncOnce(db, applying.transport);
    expect(applying.pushed.map((m) => m.record.name)).toEqual(['Trips 2024']);
    expect(await outboxRows()).toEqual([]);
  });

  it('retry pushes every failure again; a success clears it, a rejection records it again', async () => {
    await albums.create(db, makeAlbumRecord());
    await createPost(db, { text: 'Sunset' });
    await runSyncOnce(db, server(['albums', 'posts']).transport);
    expect(await failures()).toHaveLength(2);

    await retryFailures(db);
    const rejectingPosts = server(['posts']);
    await runSyncOnce(db, rejectingPosts.transport);
    expect(rejectingPosts.pushed).toHaveLength(2);
    expect((await failures()).map((failure) => failure.title)).toEqual(['Post "Sunset"']);
  });

  it("retrying leaves the failed uploads alone: they are the Backup screen's", async () => {
    const photo = await assets.create(db, makeAssetRecord());
    await runSyncOnce(db, server(['assets']).transport);
    await assets.setSyncError(db, [photo.id], 'upload failed');

    await retryFailures(db);
    expect(await countOutbox(db)).toEqual({ pending: 1, failed: 0 });
    expect(await assets.countSyncErrors(db)).toBe(1);
  });

  it('returning to the foreground retries the failed pushes before the sync it asks for', async () => {
    await albums.create(db, makeAlbumRecord());
    await runSyncOnce(db, server(['albums']).transport);
    let cleared!: Promise<void>;
    await withSyncPaused(async () => {
      setSyncTarget({ db, identity: {}, library: {} } as SyncTarget); // its sync waits for this section
      retryFailuresAndSync(); // the retry goes next, the sync after it
      cleared = withSyncPaused(async () => setSyncTarget(null)); // so the sync finds no target to reach
    });
    await cleared;

    expect(await countOutbox(db)).toEqual({ pending: 1, failed: 0 });
  });

  it('counts the pending and the failed rows in one statement, through the indexes', async () => {
    const measured = makeMeasuredTestDb();
    db = measured.db;
    await albums.create(db, makeAlbumRecord());
    await albums.create(db, makeAlbumRecord());
    await runSyncOnce(db, server(['albums']).transport);
    await albums.create(db, makeAlbumRecord());

    let counts;
    const work = await measured.measure(async () => (counts = await countOutbox(db)));
    expect(counts).toEqual({ pending: 3, failed: 2 });
    expect(work.statements).toBe(1);
    expect(work.plans.join()).toMatch(/COVERING INDEX outbox_collection_record_idx/);
    expect(work.plans.join()).toMatch(/outbox_error_idx/);
  });

  it('a rejection of a payload edited again during the push is not recorded: the edit goes next', async () => {
    const album = await albums.create(db, makeAlbumRecord({ name: 'Trips' }));
    const editing = fakeTransport({
      push: async ({ mutations }) => {
        await albums.update(db, album.id, { name: 'Edited' });
        return {
          results: mutations.map((m) => ({
            id: String(m.record.id),
            collection: m.collection,
            status: 'rejected' as const,
            reason: 'schema:name',
          })),
        };
      },
    });
    await runSyncOnce(db, editing);
    expect(await outboxRows()).toMatchObject([{ error: null, payload: { name: 'Edited' } }]);
  });

  it('names each failure after its record: posts by caption, edges by their album or post', async () => {
    const photo = await assets.create(db, makeAssetRecord({ filename: 'IMG_1.jpg' }));
    const album = await albums.create(db, makeAlbumRecord({ name: 'Trips' }));
    await albumEdges.add(db, album.id, [photo.id], () => crypto.randomUUID());
    const caption = 'A very long caption that goes on and on about the sunset\nsecond line';
    await createPost(db, { text: caption }, [photo.id]);
    await createPost(db, { text: '' });
    await runSyncOnce(db, server(['assets', 'album_assets', 'posts', 'post_assets']).transport);

    expect((await failures()).map((failure) => failure.title)).toEqual([
      'Photo IMG_1.jpg',
      'Photo in album "Trips"',
      'Post "A very long caption that goes on and on…"',
      'Photo in post "A very long caption that goes on and on…"',
      'Post',
    ]);
  });

  it('cuts a caption by code point, never inside an emoji', async () => {
    await createPost(db, { text: `${'a'.repeat(39)}😀 and more` });
    await runSyncOnce(db, server(['posts']).transport);

    expect((await failures()).map((failure) => failure.title)).toEqual([`Post "${'a'.repeat(39)}😀…"`]);
  });
});

describe('push failures of contacts, lists and their edges', () => {
  it('are named after the contact, the list, or what the contact is on; a contact’s or a list’s opens it', async () => {
    const contact = await contacts.create(db, makeContactRecord({ name: 'Maya' }));
    const list = await contactLists.create(db, {
      id: crypto.randomUUID(),
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      name: 'Climbers',
      notes: null,
      position: null,
    });
    let n = 0;
    const newId = () => `00000000-0000-4000-8000-00000000000${++n}`;
    await contactListMembers.add(db, { listId: list.id }, [contact.id], newId);
    await contactLinks.add(db, { targetType: 'album', targetId: crypto.randomUUID() }, [contact.id], newId);

    await runSyncOnce(db, server(['contacts', 'contact_lists', 'contact_list_members', 'contact_links']).transport);

    expect((await failures()).map(({ title, href }) => ({ title, href }))).toEqual([
      { title: 'Contact "Maya"', href: `/contact/${contact.id}` },
      { title: 'List "Climbers"', href: `/contact-list/${list.id}` },
      { title: 'Contact in list "Climbers"', href: undefined },
      { title: 'Contact on an album', href: undefined },
    ]);
  });
});

describe('upload failures', () => {
  it('are named after their asset', async () => {
    const video = await assets.create(db, makeAssetRecord({ filename: 'IMG_2.mov', mediaType: 'video' }));
    await assets.setSyncError(db, [video.id], 'upload failed');

    expect(await readUploadFailures(db, { limit: 50 })).toEqual({
      rows: [{ id: video.id, title: 'Video IMG_2.mov', error: 'upload failed' }],
      count: 1,
    });
  });
});
