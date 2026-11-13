import type { PushMutation } from '@squidbox/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { makeContactRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { makeTestDb } from './helpers/testDb';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { FileUploadRefusedError } from '../src/sync/fileUploadErrors';
import { retryFailures } from '../src/sync/outbox';
import { readPushFailures } from '../src/sync/readPushFailures';
import { runSyncOnce, type UploadFile } from '../src/sync/worker';
import UploadFailedError from '../src/utils/cloud-api/assets/UploadFailedError';

let db: SyncDb;
let calls: string[]; // the uploads and pushes, in order
let pushed: PushMutation[];
beforeEach(() => {
  db = makeTestDb();
  calls = [];
  pushed = [];
});

// A server that applies every push (or rejects the `rejected` collections' mutations).
function server(rejected: string[] = []) {
  return fakeTransport({
    push: async ({ mutations }) => {
      calls.push(...mutations.map((m) => `push ${m.collection} ${String(m.record.avatarFilename ?? m.record.id)}`));
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
}

const recording = (run?: (filename: string, signal: AbortSignal) => Promise<void>): UploadFile =>
  vi.fn(async (collection, field, filename, signal) => {
    calls.push(`upload ${collection}.${field} ${filename}`);
    await run?.(filename, signal);
  });

const outboxRows = () => db.select().from(schema.outbox);
const lastLog = async () => (await db.select().from(schema.syncLog)).at(-1)!;

// A contact whose record the server has (its outbox row pushed), with `avatarFilename`.
async function pushedContact(over: Parameters<typeof makeContactRecord>[0] = {}) {
  const contact = await contacts.create(db, makeContactRecord(over));
  await db.delete(schema.outbox);
  return contact;
}

describe('a file field in the sync', () => {
  it('uploads a new contact’s photo before the push that names it', async () => {
    await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-x-1.jpg' }));
    const uploadFile = recording();

    await runSyncOnce(db, server(), { uploadFile });

    expect(calls).toEqual(['upload contacts.avatarFilename avatar-x-1.jpg', 'push contacts avatar-x-1.jpg']);
    expect(uploadFile).toHaveBeenCalledWith('contacts', 'avatarFilename', 'avatar-x-1.jpg', expect.any(AbortSignal));
    expect(await outboxRows()).toEqual([]);
  });

  it('uploads nothing for an edit that leaves the photo, a removed photo or a deleted contact', async () => {
    const kept = await pushedContact({ avatarFilename: 'avatar-a-1.jpg' });
    const removed = await pushedContact({ avatarFilename: 'avatar-b-1.jpg' });
    await contacts.update(db, kept.id, { name: 'Renamed' });
    await contacts.update(db, removed.id, { avatarFilename: null });
    const deleted = await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-c-1.jpg' }));
    await contacts.remove(db, [deleted.id]);
    const uploadFile = recording();

    await runSyncOnce(db, server(), { uploadFile });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(pushed.map((m) => m.record.id).sort()).toEqual([kept.id, removed.id, deleted.id].sort());
  });

  it('a refused upload holds its contact back with the error and pushes the rest; a retry uploads it', async () => {
    const contact = await contacts.create(db, makeContactRecord({ name: 'Maya', avatarFilename: 'avatar-m-1.jpg' }));
    const other = await contacts.create(db, makeContactRecord({ name: 'Jon' }));
    const refusing = recording(async () => {
      throw new FileUploadRefusedError(
        'Contact photo upload refused (The copy of your library takes no uploads)',
        'read_only_library',
      );
    });

    await runSyncOnce(db, server(), { uploadFile: refusing });

    expect(pushed.map((m) => m.record.id)).toEqual([other.id]);
    expect(await outboxRows()).toMatchObject([
      { recordId: contact.id, error: expect.stringMatching(/^Contact photo upload refused/) },
    ]);
    expect((await readPushFailures(db, { limit: 50 })).rows).toEqual([
      {
        id: expect.any(Number),
        title: 'Contact "Maya"',
        error: expect.stringMatching(/^Contact photo upload refused/),
        href: `/contact/${contact.id}`,
      },
    ]);
    expect((await lastLog()).notes).toContain(
      `contacts ${contact.id}: upload of avatar-m-1.jpg refused (read_only_library)`,
    );

    await runSyncOnce(db, server(), { uploadFile: refusing });
    expect(refusing).toHaveBeenCalledTimes(1); // a waiting row isn't tried again

    await retryFailures(db);
    const uploadFile = recording();
    await runSyncOnce(db, server(), { uploadFile });
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(await outboxRows()).toEqual([]);
  });

  it('a contact deleted while its photo is missing on this device pushes its tombstone', async () => {
    const contact = await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-g-1.jpg' }));
    const missing = recording(async () => {
      throw new FileUploadRefusedError(
        'Contact photo is missing on this device: choose it again or remove it',
        'missing',
      );
    });
    await runSyncOnce(db, server(), { uploadFile: missing });
    expect(pushed).toEqual([]);

    await contacts.remove(db, [contact.id]);
    await runSyncOnce(db, server(), { uploadFile: missing });

    expect(missing).toHaveBeenCalledTimes(1);
    expect(pushed).toMatchObject([{ record: { id: contact.id, deletedAt: expect.any(Number) } }]);
    expect(await outboxRows()).toEqual([]);
  });

  it('a photo uploaded for a push the server rejected isn’t uploaded again on the retry', async () => {
    await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-x-1.jpg' }));
    const uploadFile = recording();
    await runSyncOnce(db, server(['contacts']), { uploadFile });
    expect(await outboxRows()).toMatchObject([{ error: 'schema:name', uploadedFiles: ['avatar-x-1.jpg'] }]);

    await retryFailures(db);
    await runSyncOnce(db, server(), { uploadFile });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(await outboxRows()).toEqual([]);
  });

  it('an abort during the upload stops the run before the push, the row pending without an error', async () => {
    await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-x-1.jpg' }));
    const controller = new AbortController();
    const uploadFile = recording(async () => {
      controller.abort();
      throw Object.assign(new Error('Uploading avatar-x-1.jpg was cancelled'), { name: 'AbortError' });
    });

    await runSyncOnce(db, server(), { uploadFile, signal: controller.signal });

    expect(pushed).toEqual([]);
    expect(await outboxRows()).toMatchObject([{ error: null, uploadedFiles: [] }]);
    expect(await lastLog()).toMatchObject({ error: null, notes: 'stopped during push' });
  });

  for (const [name, error] of [
    ['a network error', new Error('Network request failed')],
    ['a 429', new UploadFailedError('Too many concurrent uploads', { status: 429, code: 'rate_limited' })],
  ] as const) {
    it(`${name} on the upload holds that row back with the error, pushes the rest and pulls`, async () => {
      const contact = await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-x-1.jpg' }));
      const other = await contacts.create(db, makeContactRecord({ name: 'Jon' }));
      const uploadFile = recording(async () => {
        throw error;
      });

      await runSyncOnce(db, server(), { uploadFile });

      expect(pushed.map((m) => m.record.id)).toEqual([other.id]);
      expect(await outboxRows()).toMatchObject([
        { recordId: contact.id, error: `Upload of avatar-x-1.jpg failed: ${error.message}` },
      ]);
      expect(await lastLog()).toMatchObject({ error: null });
      expect((await lastLog()).notes).toContain(`contacts ${contact.id}: upload of avatar-x-1.jpg failed`);

      await retryFailures(db); // the app's return to the foreground
      await runSyncOnce(db, server(), { uploadFile: recording() });
      expect(await outboxRows()).toEqual([]);
    });
  }

  it('a photo changed during its upload is uploaded and pushed by the next run', async () => {
    const contact = await pushedContact();
    await contacts.update(db, contact.id, { avatarFilename: 'avatar-x-1.jpg' });
    const uploadFile = recording(async (filename) => {
      if (filename === 'avatar-x-1.jpg') await contacts.update(db, contact.id, { avatarFilename: 'avatar-x-2.jpg' });
    });

    await runSyncOnce(db, server(), { uploadFile });
    expect(await outboxRows()).toMatchObject([{ payload: { avatarFilename: 'avatar-x-2.jpg' } }]);
    await runSyncOnce(db, server(), { uploadFile });

    expect(calls).toEqual([
      'upload contacts.avatarFilename avatar-x-1.jpg',
      'push contacts avatar-x-1.jpg',
      'upload contacts.avatarFilename avatar-x-2.jpg',
      'push contacts avatar-x-2.jpg',
    ]);
    expect(await outboxRows()).toEqual([]);
  });

  it('a run that can’t upload files pushes no record that names one', async () => {
    await contacts.create(db, makeContactRecord({ avatarFilename: 'avatar-x-1.jpg' }));

    await expect(runSyncOnce(db, server())).rejects.toThrow('This run cannot upload files');

    expect(pushed).toEqual([]);
  });
});
