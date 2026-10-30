import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { collectionNames } from '@squidbox/shared';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';
import {
  cleanUpPurgedFiles,
  deletePurgedFiles,
  isPurgedFileKey,
  purgedFileCleanupsSettled,
} from '../src/sync/purgedFiles.js';
import { deferred } from '@squidbox/shared/testing/deferred';
import { gate } from '@squidbox/shared/testing/gate';
import {
  albumRecord,
  assetRecord,
  db,
  mut,
  pool,
  postRecord,
  rowOf,
  USER_A,
  USER_B,
  useSyncDb,
} from './helpers/syncDb.js';
import { REJECTED_NOTES } from './dbSetup.js';

// DB-backed integration tests (advisory locks, trigger, ON CONFLICT) — require a real
// Postgres. Run with `npm run test:db` (points at the docker-compose stack); plain `npm test`
// skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

d('sync engine (Postgres)', () => {
  useSyncDb();

  it('an unknown collection, Object.prototype’s names included, is rejected per mutation', async () => {
    const album = albumRecord();
    const results = await push(db as any, USER_A, [
      ...['constructor', '__proto__', 'toString', 'nope'].map((collection) => ({ collection, record: album })),
      { collection: 'albums', record: album },
    ]);
    expect(results.map((result) => result.reason ?? result.status)).toEqual([
      'unknown-collection',
      'unknown-collection',
      'unknown-collection',
      'unknown-collection',
      'applied',
    ]);
  });

  it('pull window + tombstone delivery', async () => {
    const r1 = assetRecord();
    const r2 = assetRecord();
    const res = await push(db, USER_A, [mut(r1), mut(r2)]);
    expect(res.map((r) => r.status)).toEqual(['applied', 'applied']);

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(page.hasMore).toBe(false);

    // nothing new after the cursor
    const empty = await pull(db, USER_A, { cursor: page.cursor });
    expect(empty.changes.assets.records).toHaveLength(0);

    // delete r1 (tombstone) → flows through pull with deletedAt set
    await push(db, USER_A, [mut({ ...r1, updatedAt: 2000, deletedAt: 2000 })]);
    const afterDelete = await pull(db, USER_A, { cursor: page.cursor });
    expect(afterDelete.changes.assets.records).toHaveLength(1);
    expect(afterDelete.changes.assets.records[0]).toMatchObject({ id: r1.id, deletedAt: 2000 });
  });

  describe('S3 files of purged assets', () => {
    let deleted: string[][] = [];
    let failing = new Set<string>();
    const deleteKeys = async (keys: string[]) => {
      deleted.push(keys);
      return keys.filter((key) => failing.has(key));
    };
    beforeEach(() => {
      deleted = [];
      failing = new Set();
    });
    const purgedAsset = (over: Record<string, unknown>) => assetRecord({ purgedAt: 1000, deletedAt: 1000, ...over });

    it('are deleted once, whatever the file flags say, keeping a key a live asset names', async () => {
      // A device's upload finished but its flags weren't pushed before the purge: all false here.
      const unflagged = { isFileSynced: false, isThumbnailSynced: false, isSynced: false };
      const r = assetRecord({ filename: 'p.jpg', thumbnailFilename: 'p-t.jpg', deletedAt: 1000, ...unflagged });
      await push(db, USER_A, [mut(r)]);
      const shared = assetRecord({ filename: 'p.jpg', thumbnailFilename: 'other-t.jpg' }); // a live asset, same file
      const untouched = purgedAsset({ filename: 'b.jpg', thumbnailFilename: 'b-t.jpg' });
      await push(db, USER_A, [mut(shared)]);
      await push(db, USER_B, [mut(untouched)]); // another user's purge isn't this user's work
      const { cursor } = await pull(db, USER_A, { cursor: 0, limit: 100 });
      await push(db, USER_A, [mut({ ...r, updatedAt: 2000, purgedAt: 2000 })]);

      await deletePurgedFiles(db, USER_A, deleteKeys);

      expect(deleted).toEqual([['p-t.jpg']]);
      expect(await rowOf(r.id))!.toMatchObject({ ...unflagged, updatedAt: 2000, filesDeletedAt: expect.any(Number) });
      const { changes } = await pull(db, USER_A, { cursor, limit: 100 });
      expect(changes.assets.records).toEqual([expect.objectContaining({ id: r.id, purgedAt: 2000 })]);

      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted).toHaveLength(1); // done for good
    });

    it('stay to do when the request fails, so the next cleanup retries them', async () => {
      const r = purgedAsset({});
      await push(db, USER_A, [mut(r)]);
      const failure = new Error('S3 down');
      await expect(deletePurgedFiles(db, USER_A, async () => Promise.reject(failure))).rejects.toBe(failure);
      expect((await rowOf(r.id))!.filesDeletedAt).toBeNull();
      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted).toEqual([['a.jpg', 't.jpg']]);
    });

    it('a key that fails, or can’t be a key, holds up no other asset', async () => {
      const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
      const failingAsset = purgedAsset({ id: ids[0], filename: 'bad.jpg', thumbnailFilename: 'bad-t.jpg' });
      const ok = purgedAsset({ id: ids[1], filename: 'ok.jpg', thumbnailFilename: 'ok-t.jpg' });
      const invalid = purgedAsset({ filename: '../x.jpg', thumbnailFilename: '' });
      await push(db, USER_A, [mut(failingAsset), mut(ok), mut(invalid)]);
      failing = new Set(['bad.jpg']);

      await deletePurgedFiles(db, USER_A, deleteKeys);

      expect(deleted).toEqual([['bad.jpg', 'bad-t.jpg', 'ok.jpg', 'ok-t.jpg']]); // id order, the invalid keys skipped
      expect((await rowOf(failingAsset.id))!.filesDeletedAt).toBeNull();
      expect((await rowOf(ok.id))!.filesDeletedAt).not.toBeNull();
      expect((await rowOf(invalid.id))!.filesDeletedAt).not.toBeNull();

      failing = new Set();
      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted[1]).toEqual(['bad.jpg', 'bad-t.jpg']);
      expect((await rowOf(failingAsset.id))!.filesDeletedAt).not.toBeNull();
    });

    it('run one at a time per user after the push, a push meanwhile asking for one more pass', async () => {
      await push(db, USER_A, [mut(purgedAsset({ filename: 'first.jpg', thumbnailFilename: 'first-t.jpg' }))]);
      let running = 0;
      let overlapped = false;
      const errors: unknown[] = [];
      // Each delete holds the user's lock until the test lets it go (nextHeld), one at a time.
      const held: (() => void)[] = [];
      let arrived = deferred();
      const heldDelete = async (keys: string[]) => {
        overlapped ||= running > 0;
        running += 1;
        const hold = gate();
        held.push(hold.release);
        arrived.resolve();
        await hold.hold();
        running -= 1;
        return deleteKeys(keys);
      };
      const nextHeld = async () => {
        while (held.length === 0) {
          arrived = deferred();
          await arrived.promise;
        }
        return held.shift()!;
      };

      cleanUpPurgedFiles(db, USER_A, heldDelete, (error) => errors.push(error));
      const releaseFirst = await nextHeld();
      const pushed = push(db, USER_A, [
        mut(purgedAsset({ filename: 'second.jpg', thumbnailFilename: 'second-t.jpg' })),
      ]); // waits for the lock
      cleanUpPurgedFiles(db, USER_A, heldDelete, (error) => errors.push(error));
      cleanUpPurgedFiles(db, USER_A, heldDelete, (error) => errors.push(error));
      releaseFirst();
      await pushed;
      cleanUpPurgedFiles(db, USER_A, heldDelete, (error) => errors.push(error)); // the push's, after its reply
      const settled = purgedFileCleanupsSettled().then(() => null);
      for (let release = await Promise.race([nextHeld(), settled]); release;) {
        release();
        release = await Promise.race([nextHeld(), settled]);
      }

      expect(overlapped).toBe(false);
      expect(deleted.flat().sort()).toEqual(['first-t.jpg', 'first.jpg', 'second-t.jpg', 'second.jpg']);
      expect(errors).toEqual([]);

      await push(db, USER_A, [mut(purgedAsset({ filename: 'third.jpg' }))]);
      const failure = new Error('S3 down');
      cleanUpPurgedFiles(
        db,
        USER_A,
        async () => Promise.reject(failure),
        (error) => errors.push(error),
      );
      await purgedFileCleanupsSettled();
      expect(errors).toEqual([failure]); // logged, not thrown into the push
    });

    it('a key is purged when every asset naming it is', async () => {
      await push(db, USER_A, [mut(purgedAsset({ filename: 'gone.jpg' }))]);
      await push(db, USER_A, [mut(assetRecord({ filename: 'kept.jpg', thumbnailFilename: 'gone.jpg' }))]);
      await push(db, USER_A, [mut(purgedAsset({ filename: 'only.jpg' }))]);
      expect(await isPurgedFileKey(db, USER_A, 'gone.jpg')).toBe(false); // a live asset still names it
      expect(await isPurgedFileKey(db, USER_A, 'only.jpg')).toBe(true);
      expect(await isPurgedFileKey(db, USER_A, 'new.jpg')).toBe(false); // its record isn't pushed yet
      expect(await isPurgedFileKey(db, USER_B, 'only.jpg')).toBe(false);
    });
  });

  it('concurrent pushes do not drop rows (per-user advisory lock serializes)', async () => {
    const records = Array.from({ length: 8 }, () => assetRecord());
    await Promise.all(records.map((r) => push(db, USER_A, [mut(r)])));
    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records).toHaveLength(8);
    expect(new Set(page.changes.assets.records.map((r: any) => r.id))).toEqual(new Set(records.map((r) => r.id)));
  });

  it('partial-push rejection: invalid record rejected, valid one persists', async () => {
    const good = assetRecord();
    const bad = { ...assetRecord(), mediaType: 'gif' }; // not in enum
    const res = await push(db, USER_A, [mut(good), mut(bad)]);
    expect(res[0].status).toBe('applied');
    expect(res[1].status).toBe('rejected');
    expect(res[1].reason).toContain('schema:');

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('partial-push rejection: a fractional timestamp is rejected, the rest of the push applies', async () => {
    const good = postRecord();
    const bad = postRecord({ suggestRepostAt: 1734567890123.5 }); // the server's bigint column can't take it
    const res = await push(db, USER_A, [
      { collection: 'posts', record: bad },
      { collection: 'posts', record: good },
    ]);
    expect(res[0]).toMatchObject({ id: bad.id, status: 'rejected', reason: 'schema:suggestRepostAt' });
    expect(res[1]).toMatchObject({ id: good.id, status: 'applied' });

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.posts.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('partial-push rejection: values Postgres cannot store are schema rejections, the rest applies', async () => {
    const nulByte = assetRecord({ notes: 'a\u0000b' }); // Postgres text can't hold NUL
    const tooWide = assetRecord({ width: 2 ** 31 }); // out of range for the int4 column
    const good = assetRecord();
    const res = await push(db, USER_A, [mut(nulByte), mut(tooWide), mut(good)]);
    expect(res[0]).toMatchObject({ id: nulByte.id, status: 'rejected', reason: 'schema:notes' });
    expect(res[1]).toMatchObject({ id: tooWide.id, status: 'rejected', reason: 'schema:width' });
    expect(res[2]).toMatchObject({ id: good.id, status: 'applied' });
  });

  // No record the schema accepts fails in Postgres today; the savepoint fallback is the backstop for
  // a row-level error the schema doesn't foresee. The test database refuses REJECTED_NOTES for one.
  it('partial-push rejection: a database error on one row rejects it, the rest of the push applies', async () => {
    const bad = assetRecord({ notes: REJECTED_NOTES });
    const good = assetRecord();
    const res = await push(db, USER_A, [mut(bad), mut(good)]);
    expect(res[0]).toMatchObject({ id: bad.id, status: 'rejected', reason: 'db:23514' });
    expect(res[1]).toMatchObject({ id: good.id, status: 'applied' });

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('partial-push rejection: rows before a database error get the same results as in a clean push', async () => {
    // The failing batch is rolled back and rerun row by row, so the rerun must not see its own writes.
    const r = assetRecord();
    const res = await push(db, USER_A, [
      mut({ ...r, updatedAt: 1000 }),
      mut({ ...r, updatedAt: 2000, notes: 'win' }),
      mut({ ...r, updatedAt: 1500, notes: 'lose' }),
      mut(assetRecord({ notes: REJECTED_NOTES })),
    ]);
    expect(res.map((x) => x.reason ?? x.status)).toEqual(['applied', 'applied', 'skipped-lww', 'db:23514']);
    expect(res[2].current).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'win' });

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records).toHaveLength(1);
  });

  it('a push for a deleted user fails as a whole instead of rejecting each row', async () => {
    // user_id comes from the token, so its foreign key failing is not the rows' fault.
    await expect(push(db, randomUUID(), [mut(assetRecord()), mut(assetRecord())])).rejects.toThrow(
      /assets_user_id_users_id_fk/,
    );
  });

  it('pagination: hasMore loops until drained', async () => {
    const records = Array.from({ length: 5 }, () => assetRecord());
    await push(
      db,
      USER_A,
      records.map((r) => mut(r)),
    );

    const seen: string[] = [];
    let cursor = 0;
    for (let i = 0; i < 10; i++) {
      const page = await pull(db, USER_A, { cursor, limit: 2 });
      seen.push(...page.changes.assets.records.map((r: any) => r.id));
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(new Set(seen)).toEqual(new Set(records.map((r) => r.id)));
  });

  describe('tenant isolation', () => {
    it('user B never sees user A rows; a colliding id lands in B partition, A untouched', async () => {
      const shared = assetRecord({ notes: 'A-data', updatedAt: 5000 });
      await push(db, USER_A, [mut(shared)]);

      // B does not see A's row
      const bEmpty = await pull(db, USER_B, { cursor: 0 });
      expect(bEmpty.changes.assets.records).toHaveLength(0);

      // B pushes a record with the SAME id → creates in B's own partition (composite PK)
      const bRes = await push(db, USER_B, [mut({ ...shared, notes: 'B-data', updatedAt: 9999 })]);
      expect(bRes[0].status).toBe('applied');

      // A's row is untouched; B has its own
      const aPage = await pull(db, USER_A, { cursor: 0 });
      expect(aPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'A-data', updatedAt: 5000 });
      const bPage = await pull(db, USER_B, { cursor: 0 });
      expect(bPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'B-data', updatedAt: 9999 });
    });
  });

  // The "add a collection" recipe's silent failure modes (sync-design §9): a forgotten
  // server_seq trigger (rows never pulled) and a plain-id PK (cross-tenant collision). Assert
  // both — plus a round-trip and tenant isolation — for EVERY registered collection.
  describe('collection registry guard', () => {
    const base = () => ({ id: randomUUID(), createdAt: 1000, updatedAt: 1000, deletedAt: null });
    const sample: Record<string, () => Record<string, unknown>> = {
      assets: () => assetRecord({ tags: ['forest', 'morning fog'] }),
      albums: () => albumRecord(),
      posts: () => postRecord(),
      album_assets: () => ({ ...base(), albumId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
      post_assets: () => ({ ...base(), postId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
      personas: () => ({
        ...base(),
        aboutYou: 'Outdoor photographer from Oregon.',
        contentTags: ['hiking', 'forest'],
        tone: 'Short and calm.',
        rules: ['Never use hashtags'],
        adultContent: true,
      }),
      prompt_buttons: () => ({
        ...base(),
        name: 'Shorter',
        prompt: 'Make each option shorter.',
        placement: 'refine',
        icon: null,
        position: 'a0',
      }),
      favorites: () => ({ ...base(), text: 'First light on the ridge.' }),
      instructions: () => ({
        ...base(),
        writing: 'Write like me.',
        visionTagging: null,
        moreLikeThis: null,
        modelCheckJudge: null,
      }),
      model_choices: () => ({
        ...base(),
        writingModel: { id: 'venice-uncensored-1-2', name: 'Venice Uncensored' },
        visionModel: null,
        writingUncensoredModel: { id: 'venice-uncensored-1-2', name: 'Venice Uncensored' },
        visionUncensoredModel: null,
      }),
    };

    for (const name of collectionNames) {
      it(`${name}: registered, trigger + composite PK, round-trips, tenant-isolated`, async () => {
        expect(serverCollections[name]).toBeTruthy();

        const trig = await pool.query('SELECT 1 FROM pg_trigger WHERE tgname = $1', [`${name}_server_seq`]);
        expect(trig.rowCount).toBe(1);

        const clock = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'field_clock'`,
          [name],
        );
        expect(clock.rowCount).toBe(1);

        const pk = await pool.query(
          `SELECT a.attname FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [name],
        );
        expect(pk.rows.map((r: { attname: string }) => r.attname).sort()).toEqual(['id', 'user_id']);

        const rec = sample[name]();
        const res = await push(db, USER_A, [{ collection: name, record: rec }]);
        expect(res[0].status).toBe('applied');

        const aPage = await pull(db, USER_A, { cursor: 0 });
        expect(aPage.changes[name].records.find((r: any) => r.id === rec.id)).toMatchObject(rec);

        const bPage = await pull(db, USER_B, { cursor: 0 });
        expect(bPage.changes[name]?.records.some((r: any) => r.id === rec.id) ?? false).toBe(false);

        // A per-field delete merges, comes back on pull as a tombstone, and is a no-op when replayed.
        const removal = {
          collection: name,
          record: { ...rec, updatedAt: 2000, deletedAt: 2000 },
          fields: { deletedAt: 2000 },
        };
        expect((await push(db, USER_A, [removal]))[0].status).toBe('applied');
        const { changes, cursor } = await pull(db, USER_A, { cursor: aPage.cursor });
        expect(changes[name].records).toEqual([expect.objectContaining({ id: rec.id, deletedAt: 2000 })]);
        expect(changes[name].records[0]).not.toHaveProperty('fieldClock');
        expect((await push(db, USER_A, [removal]))[0].status).toBe('applied');
        expect((await pull(db, USER_A, { cursor })).changes[name].records).toEqual([]);
      });
    }
  });
});
