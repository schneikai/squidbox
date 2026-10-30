import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

import { albumOrder } from './helpers/albumOrder';
import { createPost, makeAlbumRecord, makeAssetRecord, makePostRecord } from './helpers/factory';
import { pushViolations } from './helpers/pushViolations';
import {
  A,
  B,
  C,
  HOUR,
  S,
  SERVER_NOW,
  USER,
  albumRepo,
  at,
  edit,
  expectConverged,
  localRow,
  pgDb,
  posts,
  pullOnly,
  pushLog,
  seedAlbum,
  seedAsset,
  serverRaw,
  serverRow,
  settle,
  sync,
  synced,
  transportOf,
  useTwoDeviceServer,
  violations,
} from './helpers/twoDeviceServer';
import * as serverSchema from '../../server/src/db/schema.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import readPost from '../src/features/post-detail/readPost';
import * as repo from '../src/sync/assetsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { runSyncOnce } from '../src/sync/worker';
import changedValues from '../src/utils/changedValues';
import noteText from '../src/utils/noteText';
import postAssetsToAssetRefs from '../src/utils/posts/postAssetsToAssetRefs';

// Two devices and an old app editing the same records: per-field merge, field groups, editors,
// album edges, idempotency and many records.
// Devices A, B and an old app C run against the real server engine on Postgres
// (helpers/twoDeviceServer). A library merge only lists and moves files; these devices have none.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', async () => (await import('./helpers/fakeDevice')).noFiles());

// Run with `npm run test:e2e` (docker stack up); skipped otherwise.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

d('per-field merge, adversarial (devices A, B, an old app C ↔ server)', () => {
  useTwoDeviceServer();

  describe('two devices, one record', () => {
    it('edits of different fields both survive, whichever device pushes or pulls first', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAsset();
        await edit(A, S + 100, () => repo.update(A, id, { notes: 'from A' }));
        await edit(B, S + 200, () => repo.toggleFavorite(B, id));
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect(await expectConverged('assets', id)).toMatchObject({ notes: 'from A', isFavorite: true });
      }
    });

    it('a device that pulls while its edit waits shows the other edit at once, and both survive', async () => {
      const id = await seedAlbum({ name: 'Trip' });
      await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'Summer trip' }));
      await edit(B, S + 200, () => albumRepo.update(B, id, { notes: 'beach' }));
      await sync(B);
      await pullOnly(A);
      expect(await localRow(A, 'albums', id)).toMatchObject({ name: 'Summer trip', notes: 'beach' });
      await pullOnly(B); // nothing pending on B
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({ name: 'Summer trip', notes: 'beach' });
    });

    it('edits of the same field keep the later clock, in either push order', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAsset();
        await edit(A, S + 100, () => repo.update(A, id, { notes: 'older, A' }));
        await edit(B, S + 200, () => repo.update(B, id, { notes: 'newer, B' }));
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect((await expectConverged('assets', id)).notes).toBe('newer, B');
        expect((await serverRaw('assets', id))!.fieldClock.notes).toBe(S + 200);
      }
    });

    it('edits of the same field in the same millisecond keep the first one pushed', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.update(A, id, { notes: 'A' }));
      await edit(B, S + 100, () => repo.update(B, id, { notes: 'B' }));
      await sync(B);
      await sync(A);
      await settle();
      expect((await expectConverged('assets', id)).notes).toBe('B');
    });

    it('a device whose clock is an hour ahead is clamped: a later edit elsewhere still wins, and its own later edit too', async () => {
      const id = await seedAsset();
      await edit(A, S + 1000 + HOUR, () => repo.update(A, id, { notes: 'A, clock ahead' }));
      await sync(A, { now: S + 1000 }); // clamped to the server's clock
      expect((await serverRaw('assets', id))!.fieldClock.notes).toBe(S + 1000);
      await edit(B, S + 2000, () => repo.update(B, id, { notes: 'B, later' }));
      await sync(B, { now: S + 3000 });
      await settle([A, B, C], S + 4000);
      expect((await expectConverged('assets', id)).notes).toBe('B, later');

      // A edits again, an hour ahead still: clamped to the server's time, it's the newest edit.
      await edit(A, S + 5000 + HOUR, () => repo.update(A, id, { notes: 'A again', isFavorite: true }));
      await settle([A, B, C], S + 6000);
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A again', isFavorite: true });
      expect((await serverRaw('assets', id))!.fieldClock).toMatchObject({ notes: S + 6000, isFavorite: S + 6000 });
    });

    it('a device whose clock is an hour behind loses an edit it made unseen, but wins once it pulled', async () => {
      const id = await seedAsset();
      await edit(A, S + 1000, () => repo.update(A, id, { notes: 'A' }));
      await sync(A, { now: S + 1100 });
      // B, an hour behind, edits before pulling A's edit: its clock says it is older (§7, a known limit).
      await edit(B, S + 2000 - HOUR, () => repo.update(B, id, { notes: 'B, clock behind' }));
      await settle([A, B, C], S + 2100);
      expect((await expectConverged('assets', id)).notes).toBe('A');

      // Having pulled, B's next edit gets a clock above the record's: it wins.
      await edit(B, S + 3000 - HOUR, () => repo.update(B, id, { notes: 'B, after the pull' }));
      await edit(C, S + 3000, () => posts.create(C, makePostRecord({ createdAt: S, text: 'unrelated' })));
      await settle([A, B, C], S + 3100);
      expect((await expectConverged('assets', id)).notes).toBe('B, after the pull');
    });

    it('an edit of a field just pulled around a pending edit gets a clock above the pulled one', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.update(A, id, { notes: 'A, pending' }));
      await edit(B, S + 500, () => repo.toggleFavorite(B, id)); // true, at S+500
      await sync(B);
      await pullOnly(A);
      expect(await localRow(A, 'assets', id)).toMatchObject({ notes: 'A, pending', isFavorite: true });
      // A's clock (S+200) is behind the pulled edit; its unfavorite must still be the newer one.
      await edit(A, S + 200, () => repo.toggleFavorite(A, id));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A, pending', isFavorite: false });
    });

    it('offline edits coalesced in the outbox keep each field’s own clock, in either push order', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAlbum({ name: 'orig' });
        await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'A name' }));
        await edit(B, S + 200, () => albumRepo.update(B, id, { notes: 'B notes' }));
        await edit(A, S + 300, () => albumRepo.update(A, id, { notes: 'A notes' }));
        await edit(B, S + 400, () => albumRepo.update(B, id, { name: 'B name' }));
        await edit(A, S + 500, () => albumRepo.update(A, id, { archivedAt: 111 }));
        await edit(B, S + 600, () => albumRepo.update(B, id, { archivedAt: 222 }));
        await edit(A, S + 700, () => albumRepo.toggle(A, id, 'isFavorite'));
        const [pendingA] = await A.select().from(clientSchema.outbox);
        expect(pendingA!.fields).toEqual({ name: S + 100, notes: S + 300, archivedAt: S + 500, isFavorite: S + 700 });
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect(await expectConverged('albums', id)).toMatchObject({
          name: 'B name',
          notes: 'A notes',
          archivedAt: 222,
          isFavorite: true,
        });
      }
    });
  });

  describe('an old app (whole-record pushes) beside the new ones', () => {
    it('an older old-app edit keeps its field and loses its stale others: skipped-lww with the merged current', async () => {
      const id = await seedAsset({ notes: 'orig' });
      await edit(C, S + 100, () => repo.toggleFavorite(C, id));
      await edit(A, S + 200, () => repo.update(A, id, { notes: 'A' }));
      await sync(A);
      await sync(C);
      const [result] = pushLog.at(-1)!.results;
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'A', isFavorite: true } });
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A', isFavorite: true });
    });

    it('a newer old-app edit stamps every field it carries, so it rewrites an older edit of another field (§7)', async () => {
      const id = await seedAsset({ notes: 'orig' });
      await edit(A, S + 100, () => repo.update(A, id, { notes: 'A' }));
      await sync(A);
      await edit(C, S + 200, () => repo.toggleFavorite(C, id)); // C never pulled A's notes
      await sync(C);
      expect(pushLog.at(-1)!.results[0]!.status).toBe('applied');
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'orig', isFavorite: true });
    });

    it('interleaved on the same records, in every order, all converge and the old app never loses its edit unreported', async () => {
      const orders = [
        [A, C, B],
        [C, A, B],
        [B, C, A],
        [C, B, A],
      ];
      for (const order of orders) {
        const id = await seedAlbum({ name: 'orig', notes: 'orig' });
        await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'A name' }));
        await edit(C, S + 200, () => albumRepo.update(C, id, { notes: 'C notes' }));
        await edit(B, S + 300, () => albumRepo.toggle(B, id, 'isFavorite'));
        await edit(C, S + 400, () => albumRepo.update(C, id, { archivedAt: 5 }));
        const before = pushLog.length;
        for (const device of order) await sync(device);
        await settle();
        const row = await expectConverged('albums', id);
        // C's whole record at S+400 is newer than everything: its stale name and favorite win too.
        expect(row).toMatchObject({ notes: 'C notes', archivedAt: 5, name: 'orig', isFavorite: false });
        // A or B lost their edit to it, each told so by the push that lost or by the pull after.
        const cPush = pushLog.slice(before).find((entry) => entry.device === C)!;
        expect(cPush.results[0]!.status).toBe('applied');
      }
    });

    it('an old-app restore with a stale record undeletes, and a new device’s newer delete beats it back', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(C, S + 200, () => repo.updateAll(C, [id], { deletedAt: null }));
      await sync(C);
      await edit(B, S + 300, () => repo.remove(B, [id]));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 300 });
    });

    it('an old-app edit older than a purge never brings the record back', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(C, S + 900, () => repo.updateAll(C, [id], { deletedAt: null, notes: 'C' })); // newer even
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ purgedAt: S + 200, deletedAt: S + 100 });
    });
  });

  describe('field groups', () => {
    it('the file flags come whole from the newer side, never mixed, and an edit of another field leaves them', async () => {
      for (const aNewer of [false, true]) {
        const id = await seedAsset({ isFileSynced: false, isThumbnailSynced: false, isSynced: false });
        await edit(A, aNewer ? S + 300 : S + 100, () =>
          repo.update(A, id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true }),
        );
        await edit(B, S + 200, () => repo.update(B, id, { isThumbnailSynced: true }));
        await edit(C, S + 50, () => repo.update(C, id, { notes: 'C, oldest' })); // an old app, stale flags
        await sync(B);
        await sync(A);
        await sync(C);
        await settle();
        const row = await expectConverged('assets', id);
        expect(row).toMatchObject(
          aNewer
            ? { isFileSynced: true, isThumbnailSynced: true, isSynced: true }
            : { isFileSynced: false, isThumbnailSynced: true, isSynced: false },
        );
        expect(row.notes).toBe('C, oldest');
      }
    });
  });

  describe('editors', () => {
    it('EditPostScreen saves only what the user changed: another device’s newer text survives a stale form', async () => {
      at(S);
      const postId = randomUUID();
      const [asset1, asset2] = [randomUUID(), randomUUID()];
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'draft' }, [asset1]);
      await settle();
      // A opens the editor: its seed is the post as it is now.
      const seedRow = (await localRow(A, 'posts', postId))!;
      const seedEdges = await A.select().from(clientSchema.postAssets);
      const original = {
        text: seedRow.text,
        assetRefs: seedEdges.map((e) => ({ id: e.id, assetId: e.assetId })),
        postedAt: seedRow.postedAt,
      };
      await edit(B, S + 100, () => posts.update(B, postId, { text: 'B rewrote it' }));
      await sync(B);
      await sync(A); // the edit arrives while A's editor is open
      // A saves the form: the stale text, a post date and a second photo.
      const data = {
        ...original,
        postedAt: 12345,
        assetRefs: [...original.assetRefs, { id: randomUUID(), assetId: asset2 }],
      };
      await edit(A, S + 200, async () => {
        const changes = changedValues(original, data);
        expect(Object.keys(changes).sort()).toEqual(['assetRefs', 'postedAt']);
        const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
        await A.transaction(async (tx) => {
          const { assetRefs, ...fields } = changes;
          await postEdges.setRefs(tx, postId, assetRefs, original.assetRefs);
          await posts.update(tx, postId, fields);
        });
      });
      await settle();
      expect(await expectConverged('posts', postId)).toMatchObject({ text: 'B rewrote it', postedAt: 12345 });
      const edges = (await B.select().from(clientSchema.postAssets)).filter((e) => e.deletedAt === null);
      expect(edges.map((e) => e.assetId).sort()).toEqual([asset1, asset2].sort());
    });

    // The seed as EditPostScreen really builds it (readPost → PostEditor's postData), and
    // the save as PostsProvider.updatePost writes it.
    const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
    async function openEditor(device: SyncDb, postId: string) {
      const post = await readPost(device, postId);
      return { text: post.text, assetRefs: postAssetsToAssetRefs(post.postAssets), postedAt: post.postedAt };
    }
    async function savePost(
      device: SyncDb,
      postId: string,
      seed: Record<string, unknown>,
      data: Record<string, unknown>,
    ) {
      const updates = changedValues(seed, data);
      const { assetRefs, ...fields } = updates;
      await device.transaction(async (tx) => {
        if (assetRefs) await postEdges.setRefs(tx, postId, assetRefs as never, seed.assetRefs as never);
        await posts.update(tx, postId, fields);
      });
      return updates;
    }
    const postAssetIds = async (device: SyncDb, postId: string) =>
      ((await readPost(device, postId))?.postAssets ?? []).map((ref: { asset: { id: string } }) => ref.asset.id);

    it('EditPostScreen’s real seed: another device’s text and added photo, arriving while the editor is open, survive a date change', async () => {
      const [x, y] = [await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'draft', postedAt: null }, [x]);
      await settle();
      const seed = await openEditor(A, postId);
      expect(seed).toEqual({ text: 'draft', assetRefs: [{ id: expect.any(String), assetId: x }], postedAt: null });
      await edit(B, S + 100, async () => {
        await posts.update(B, postId, { text: 'B rewrote it' });
        await postEdges.createFromRefs(B, postId, [{ id: randomUUID(), assetId: y }]);
      });
      await sync(B);
      await sync(A); // arrives while A's editor is open
      at(S + 200);
      expect(await savePost(A, postId, seed, { ...seed, postedAt: 12345 })).toEqual({ postedAt: 12345 });
      await settle();
      expect(await expectConverged('posts', postId)).toMatchObject({ text: 'B rewrote it', postedAt: 12345 });
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y].sort());
    });

    // A post's photo whose purge waits for the server is hidden from the post (postQuery never shows a
    // purged asset), so it is missing from the editor's seed. Saving a changed photo list removes only
    // the edges the user took out of the seed (edgesRepository setRefs), so a restore made elsewhere
    // that beats the purge (§7) puts the photo back where it was in the post.
    it('a post edited while one of its photos waits on a purge: a restore that beats the purge puts it back in the post', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y]);
      await edit(A, S + 50, () => repo.remove(A, [x]));
      await settle();
      await edit(B, S + 100, () => repo.updateAll(B, [x], { deletedAt: null })); // B restores x
      await sync(B);
      await edit(A, S + 200, () => repo.purgeAssets(A, [x])); // A, not having pulled the restore
      const seed = await openEditor(A, postId);
      expect(seed.assetRefs.map((ref: { assetId: string }) => ref.assetId)).toEqual([y]); // x is hidden
      await edit(A, S + 300, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      expect(await expectConverged('assets', x)).toMatchObject({ deletedAt: null, purgedAt: null }); // the restore won
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y, z].sort());
    });

    // The same rule keeps a photo another device added while the editor was open: the save removes
    // only what the user removed, as an album's reorder keeps the edges it wasn't given (§7).
    it('a photo another device added to the post while the editor was open survives a save that adds one too', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x]);
      await settle();
      const seed = await openEditor(A, postId);
      await edit(B, S + 100, () => postEdges.createFromRefs(B, postId, [{ id: randomUUID(), assetId: y }]));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      await edit(A, S + 200, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y, z].sort());
    });

    // Two devices that add the same photo to a post offline each make an edge for it, and after the
    // sync the post has both; postQuery shows one per asset, so the editor's seed names only that one.
    // Taking the photo out tombstones every live edge to it, so it leaves the post.
    it('a photo both devices added to the post offline leaves it when the editor takes it out', async () => {
      const [x, y] = [await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x]);
      await settle();
      for (const [device, t] of [
        [A, S + 100],
        [B, S + 150],
      ] as const) {
        const seed = await openEditor(device, postId);
        await edit(device, t, () =>
          savePost(device, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: y }] }),
        );
      }
      await settle();
      expect(await postAssetIds(A, postId)).toEqual([x, y]); // one per asset

      const seed = await openEditor(A, postId);
      const kept = seed.assetRefs.filter((ref: { assetId: string }) => ref.assetId !== y);
      await edit(A, S + 300, () => savePost(A, postId, seed, { ...seed, assetRefs: kept }));
      await settle();
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([x]);
    });

    // The seed's other half: a seed edge another device removed while the editor was open stays out
    // when the user saves an unrelated photo change; only a ref the user added is restored.
    it('a photo another device took out of the post while the editor was open stays out after a save that adds one', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y]);
      await settle();
      const seed = await openEditor(A, postId);
      await edit(B, S + 100, () => postEdges.remove(B, postId, [y]));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      await edit(A, S + 200, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, z].sort());
    });

    it('a rename and an album notes edit from their seeds keep the other device’s fields', async () => {
      const id = await seedAlbum({ name: 'Trip', notes: null });
      const seed = (await localRow(A, 'albums', id))!;
      await edit(B, S + 100, () => albumRepo.update(B, id, { notes: 'B notes', isFavorite: true }));
      await sync(B);
      await sync(A);
      await edit(A, S + 200, async () => {
        // As the editors do (MoreAction's rename, AlbumNotesScreen): write a field that changed.
        const name = 'Summer trip';
        if (name !== seed.name) await albumRepo.update(A, id, { name });
        // The notes modal opened before B's edit arrived and saved it unchanged: nothing to write.
        const notes = noteText(seed.notes ?? '');
        if (notes !== noteText(seed.notes)) await albumRepo.update(A, id, { notes });
      });
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({
        name: 'Summer trip',
        notes: 'B notes',
        isFavorite: true,
      });
    });

    // A save is an edit of its seed (edgesRepository setRefs), and what the user moved is read
    // against the seed's order, not the edges' current keys. B drags z to the front of the post while
    // A's editor is open; A, seeded before that arrived, only adds w: B's move and A's add both survive.
    it('a photo another device moved while the editor was open stays where it moved it after a save that only adds one', async () => {
      const [x, y, z, w] = [await seedAsset(), await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y, z]);
      await settle();
      const seedA = await openEditor(A, postId);
      const seedB = await openEditor(B, postId);
      const [rx, ry, rz] = seedB.assetRefs;
      await edit(B, S + 100, () => savePost(B, postId, seedB, { ...seedB, assetRefs: [rz, rx, ry] }));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([z, x, y]);
      await edit(A, S + 200, () =>
        savePost(A, postId, seedA, { ...seedA, assetRefs: [...seedA.assetRefs, { id: randomUUID(), assetId: w }] }),
      );
      await settle();
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([z, x, y, w]);
    });
  });

  describe('albums and their edges', () => {
    it('an album deleted on A while B reorders and renames it: it and its edges stay deleted, B’s values kept', async () => {
      const albumEdges = makeEdgeRepository('album_assets', clientSchema.albumAssets, 'albumId');
      const id = await seedAlbum({ name: 'Trip' });
      const [a1, a2, a3] = [randomUUID(), randomUUID(), randomUUID()];
      await edit(A, S + 10, () => albumEdges.add(A, id, [a1, a2, a3], randomUUID));
      await settle();
      await edit(A, S + 100, async () => {
        await albumRepo.remove(A, [id]);
        await albumEdges.tombstoneParent(A, id);
      });
      await edit(B, S + 200, async () => {
        await albumEdges.reorder(B, id, [a3, a1, a2]);
        await albumRepo.update(B, id, { name: 'Summer' });
      });
      await sync(B);
      await sync(A);
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({ name: 'Summer', deletedAt: S + 100 });
      const edges = await A.select().from(clientSchema.albumAssets);
      expect(edges).toHaveLength(3);
      for (const e of edges) {
        expect(e.deletedAt).toBe(S + 100);
        await expectConverged('album_assets', e.id);
      }
      expect(
        albumOrder(
          edges.map((e) => ({ ...e, deletedAt: null })),
          id,
        ),
      ).toEqual([a3, a1, a2]);
    });

    it('a post edge removed on A and put back on B later: the newer re-add wins', async () => {
      const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
      at(S);
      const postId = randomUUID();
      const asset = randomUUID();
      const edgeId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S }, [asset], () => edgeId);
      await settle();
      await edit(A, S + 100, () => postEdges.remove(A, postId, [asset]));
      await sync(A);
      await sync(B);
      await edit(B, S + 300, () => postEdges.setRefs(B, postId, [{ id: edgeId, assetId: asset }], []));
      await settle();
      expect(await expectConverged('post_assets', edgeId)).toMatchObject({ deletedAt: null });
    });
    it('album membership: a concurrent add (A) and reorder (B) BOTH survive', async () => {
      const albumEdges = makeEdgeRepository('album_assets', clientSchema.albumAssets, 'albumId');
      const newId = () => randomUUID();
      const albumId = randomUUID();
      const [a1, a2, a3, a4] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

      // A creates the album with [a1, a2, a3] and both devices sync up.
      await albumRepo.create(A, makeAlbumRecord({ createdAt: 1000, updatedAt: 1000, id: albumId, name: 'Trip' }));
      await albumEdges.add(A, albumId, [a1, a2, a3], newId);
      await sync(A);
      await sync(B);

      // Offline: A adds a4 (new edge row); B reorders a3 to the front (rewrites positions).
      await albumEdges.add(A, albumId, [a4], newId);
      await albumEdges.reorder(B, albumId, [a3, a1, a2]);

      // Drain until both settle.
      for (let i = 0; i < 2; i++) {
        await sync(A);
        await sync(B);
      }

      const orderA = albumOrder(await A.select().from(clientSchema.albumAssets), albumId);
      const orderB = albumOrder(await B.select().from(clientSchema.albumAssets), albumId);
      expect(orderA).toEqual(orderB); // converged
      expect(orderA).toContain(a4); // A's add survived B's reorder
      expect(orderA.indexOf(a3)).toBeLessThan(orderA.indexOf(a1)); // B's reorder survived A's add
      expect(new Set(orderA)).toEqual(new Set([a1, a2, a3, a4]));
    });
  });

  describe('idempotency', () => {
    it('a replayed push (the request sent twice) is applied twice and changes nothing more', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.update(A, id, { notes: 'A', isFavorite: true }));
      at(SERVER_NOW);
      let seqAfterFirst: unknown;
      await runSyncOnce(A, {
        push: async (req) => {
          await serverPush(pgDb as any, USER, req.mutations);
          seqAfterFirst = (await serverRaw('assets', id))!.serverSeq;
          const results = await serverPush(pgDb as any, USER, req.mutations);
          violations.push(...(await pushViolations(req.mutations, results, serverRow)));
          expect(results.map((r) => r.status)).toEqual(['applied']);
          return { results };
        },
        pull: (req) => serverPull(pgDb as any, USER, req),
      });
      expect((await serverRaw('assets', id))!.serverSeq).toBe(seqAfterFirst);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A', isFavorite: true });
    });

    it('an outbox pushed again after a crash before its results were applied converges, a newer edit elsewhere included', async () => {
      const contested = await seedAsset();
      const quiet = await seedAsset();
      await edit(A, S + 100, () => repo.update(A, contested, { notes: 'A' }));
      await edit(A, S + 110, () => repo.update(A, quiet, { notes: 'A quiet' }));
      at(SERVER_NOW);
      await expect(
        runSyncOnce(A, {
          push: async (req) => {
            await serverPush(pgDb as any, USER, req.mutations);
            throw new Error('crashed before the results were applied');
          },
          pull: (req) => serverPull(pgDb as any, USER, req),
        }),
      ).rejects.toThrow('crashed');
      expect(await A.select().from(clientSchema.outbox)).toHaveLength(2);
      const quietSeq = (await serverRaw('assets', quiet))!.serverSeq;

      await edit(B, S + 200, () => repo.update(B, contested, { notes: 'B, newer' }));
      await sync(B);
      await sync(A); // the re-push: the contested edit loses now, the other is a replay
      const replay = pushLog.at(-1)!.results;
      expect(replay.find((r) => r.id === contested)).toMatchObject({
        status: 'skipped-lww',
        current: { notes: 'B, newer' },
      });
      expect(replay.find((r) => r.id === quiet)!.status).toBe('applied');
      expect((await serverRaw('assets', quiet))!.serverSeq).toBe(quietSeq);
      await settle();
      expect((await expectConverged('assets', contested)).notes).toBe('B, newer');
      expect((await expectConverged('assets', quiet)).notes).toBe('A quiet');
    });
  });

  describe('many records', () => {
    it('1,200 records across push batches of 500, mixed with conflicts and an edit during the push, converge', async () => {
      const n = 1200;
      at(S);
      const created = await repo.createMany(
        A,
        Array.from({ length: n }, (_, i) => makeAssetRecord({ createdAt: S, updatedAt: S, filename: `f${i}.jpg` })),
      );
      const ids = created.map((r) => r.id);
      await settle([A, B]);

      await edit(A, S + 100, () => repo.updateAll(A, ids, { notes: 'A' }));
      await edit(B, S + 200, () => repo.updateAll(B, ids, { isFavorite: true }));
      await edit(B, S + 300, () =>
        repo.updateAll(
          B,
          ids.filter((_, i) => i % 3 === 0),
          { notes: 'B' },
        ),
      );
      await edit(A, S + 400, () =>
        repo.remove(
          A,
          ids.filter((_, i) => i % 5 === 0),
        ),
      );
      await sync(B);

      // While A's first batch is at the server, A edits a record of that batch again.
      let pushes = 0;
      const base = transportOf(A);
      at(SERVER_NOW);
      await runSyncOnce(A, {
        pull: base.pull,
        push: async (req) => {
          pushes += 1;
          expect(req.mutations.length).toBeLessThanOrEqual(500);
          const response = await base.push(req);
          if (pushes === 1) {
            const pushedId = String(req.mutations[9]!.record.id);
            at(S + 500);
            await repo.update(A, pushedId, { notes: 'A, during the push' });
            at(SERVER_NOW);
          }
          return response;
        },
      });
      expect(pushes).toBe(3);
      await settle([A, B]);

      const byId = async (device: SyncDb) =>
        new Map((await device.select().from(clientSchema.assets)).map((row) => [row.id, synced('assets', row)]));
      const serverRows = await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
      const server = new Map(serverRows.map((row) => [row.id, synced('assets', row)]));
      expect(server.size).toBe(n);
      expect(await byId(A)).toEqual(server);
      expect(await byId(B)).toEqual(server);
      for (const device of [A, B]) expect(await device.select().from(clientSchema.outbox)).toEqual([]);

      const duringPush = String(pushLog.find((entry) => entry.device === A)!.mutations[9]!.record.id);
      for (const [i, id] of ids.entries()) {
        const row = server.get(id)!;
        const notes = id === duringPush ? 'A, during the push' : i % 3 === 0 ? 'B' : 'A';
        expect(row).toMatchObject({ notes, isFavorite: true, deletedAt: i % 5 === 0 ? expect.any(Number) : null });
      }
    }, 120_000);
  });
});
