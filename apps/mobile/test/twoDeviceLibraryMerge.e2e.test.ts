import { type AssetRecord } from '@squidbox/shared';
import { describe, it, expect, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import {
  A,
  B,
  S,
  at,
  edit,
  expectConverged,
  localRow,
  seedAsset,
  settle,
  sync,
  useTwoDeviceServer,
} from './helpers/twoDeviceServer';
import { libraryPaths } from '../src/library/libraryPaths';
import { applyMerge, finishMerge, mergeWaits, planMerge } from '../src/library/mergeLibrary';
import * as repo from '../src/sync/assetsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { setMergeTarget, setOwner } from '../src/sync/status';
import { sweepPurgedFiles } from '../src/sync/sweepPurgedFiles';
import { upsertRows } from '../src/sync/upsertRows';

// A device library merged into the account library while other devices edit the same records.
// Devices A, B and an old app C run against the real server engine on Postgres
// (helpers/twoDeviceServer). A library merge only lists and moves files; these devices have none.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', async () => (await import('./helpers/fakeDevice')).noFiles());

// Run with `npm run test:e2e` (docker stack up); skipped otherwise.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

d('per-field merge, adversarial (devices A, B, an old app C ↔ server)', () => {
  useTwoDeviceServer();

  describe('a device library merged into the account library', () => {
    // D is this device's library from before the sign-in: it holds a copy of the account's asset
    // (an earlier merge copied it) with edits made there since, and merges into A, the account's.
    // A pass committed into the account's library T after its first pull: the marker, then the commit.
    // The source learns the pass's marks once T has pushed it (finishPass, as mergeRun does then).
    async function commitPass(D: SyncDb, T: SyncDb, t: number) {
      await setMergeTarget(D, { library: 'T', serverId: 's1', userId: 'u1' });
      await mergeInto(T, D, t);
    }
    const finishPass = (D: SyncDb, T: SyncDb) => finishMerge(D, T, libraryPaths('device').dbName);
    async function deviceLibraryWith(id: string) {
      const D = makeTestDb();
      await upsertRows(D, 'assets', clientSchema.assets, [{ ...(await localRow(A, 'assets', id))!, syncError: null }]);
      return D;
    }
    async function mergeInto(target: SyncDb, D: SyncDb, t: number) {
      at(t);
      await applyMerge(target, await planMerge(D, target, libraryPaths('device'), libraryPaths('account')));
    }

    it('replays the device’s edits field by field against the account’s newer pending edit and another device’s', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.update(D, id, { notes: 'device' }));
      await edit(D, S + 400, () => repo.update(D, id, { oldFileId: 'device' }));
      await edit(D, S + 450, () => repo.update(D, id, { mediaLibraryAssetId: 'device' }));
      await edit(A, S + 300, () => repo.update(A, id, { notes: 'account' }));
      await edit(B, S + 200, () => repo.toggleFavorite(B, id));
      await edit(B, S + 500, () => repo.update(B, id, { oldFileId: 'B' }));
      await sync(B);
      await mergeInto(A, D, S + 600);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({
        notes: 'account',
        isFavorite: true,
        oldFileId: 'B',
        mediaLibraryAssetId: 'device',
      });
    });

    // A device library sweeps a purge at once, "which nothing can restore" (§7a), but not once a merge
    // pass has copied its records into the account (the merge marker in its database): opened again
    // while the session is lost (resumeMerges skips it then), its purge of a copied photo reaches the
    // account only with the next pass, where a later restore on another device beats it. The photo is
    // then live in the account, and its files must still be there, the original included if it was
    // never uploaded.
    it('a purge in a device library already merged in part loses to a later restore: its files must still be there', async () => {
      const id = await seedAsset({
        filename: 'only-here.jpg',
        thumbnailFilename: 'only-here-t.jpg',
        isFileSynced: false,
        isThumbnailSynced: false,
        isSynced: false,
      });
      const D = await deviceLibraryWith(id); // a first merge pass copied it into the account
      await setOwner(D, { kind: 'device' });
      await setMergeTarget(D, { library: 'account', serverId: 's1', userId: 'u1' });
      await edit(D, S + 100, () => repo.remove(D, [id]));
      await edit(D, S + 200, () => repo.purgeAssets(D, [id]));
      const removed: string[] = [];
      // The device library's own sweep, at its open and after the purge.
      await sweepPurgedFiles(D, async (files) => {
        removed.push(...files.flatMap((f) => [f.filename, f.thumbnailFilename].filter((n): n is string => !!n)));
      });
      await edit(B, S + 150, () => repo.remove(B, [id]));
      await sync(B);
      await edit(B, S + 300, () => repo.updateAll(B, [id], { deletedAt: null }));
      await sync(B);
      await mergeInto(A, D, S + 400); // the next pass
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(removed).toEqual([]);
    });

    // "Target gone": a first pass copied the photo into the account's library T1, which pushed it, then
    // T1 left the list (resumeMerges clears the list's marker and keeps the source's). Opened while
    // the session is lost, the device library trashes the photo, whose file stays. The next sign-in's
    // merge into a new library T2 waits for T2's first full pull (mergeRun), which brings the photo,
    // so the device's deletion replays by id.
    it('after the target is gone, a deletion made in the device library reaches the account through the next merge', async () => {
      const id = await seedAsset({ isFileSynced: false, isThumbnailSynced: false, isSynced: false }); // T1 pushed it
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      await setMergeTarget(D, { library: 'gone', serverId: 's1', userId: 'u1' });
      await edit(D, S + 100, () => repo.remove(D, [id]));
      const T2 = makeTestDb(); // the account's new library
      await settle([A, B, T2]); // its first full pull
      at(S + 200);
      const plan = await planMerge(D, T2, libraryPaths('device'), libraryPaths('account'));
      await applyMerge(T2, plan);
      await settle([A, B, T2]);
      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({ deletedAt: S + 100 });
    });

    // The device library's outbox is never cleared, so a pass run again (a crash after the commit, a
    // resumed merge) sees the same rows; replayed again, they would set the account's library back to
    // the device's values (a rename, an edge's asset, a restore) until the server's answer came back,
    // and push them once more. The target records the newest clock a committed pass replayed, and only
    // newer edits replay.
    it('a pass run again replays nothing a committed pass did, only what the device edited since', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.update(D, id, { notes: 'device' }));
      await edit(D, S + 110, () => repo.updateAll(D, [id], { deletedAt: S + 110 }));
      await mergeInto(A, D, S + 200);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'device', deletedAt: S + 110 });
      await edit(B, S + 300, () => repo.update(B, id, { notes: 'account' }));
      await edit(B, S + 310, () => repo.updateAll(B, [id], { deletedAt: null }));
      await sync(B);
      await settle();
      const again = await planMerge(D, A, libraryPaths('device'), libraryPaths('account'));
      expect(again.replays).toEqual([]);
      await applyMerge(A, again);
      expect(await localRow(A, 'assets', id)).toMatchObject({ notes: 'account', deletedAt: null }); // not set back
      // An edit the device makes after the commit still replays.
      await edit(D, S + 600, () => repo.update(D, id, { oldFileId: 'later' }));
      const later = await planMerge(D, A, libraryPaths('device'), libraryPaths('account'));
      expect(later.replays.map((row) => Object.keys(row.fields))).toEqual([['oldFileId']]);
      await applyMerge(A, later);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({
        notes: 'account',
        deletedAt: null,
        oldFileId: 'later',
      });
    });

    // The sign-in merged the device library right after the switch, into the
    // account's library on a new phone, new and empty: the camera-roll match found nothing, and the
    // account's photo arrived with the first full pull beside the copy. Every merge waits for the
    // target's first full pull now, and runs when it drains (usePendingMerges).
    it('a photo the account has from the same camera-roll item isn’t duplicated by a sign-in on a new phone', async () => {
      await seedAsset({ mediaLibraryAssetId: 'camera-roll-1', filename: 'from-a.jpg' }); // on the account
      const D = makeTestDb(); // the new phone's device library, before the sign-in
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.create(
        D,
        makeAssetRecord({ mediaLibraryAssetId: 'camera-roll-1', filename: 'on-phone.jpg', isFileSynced: false }),
      );
      const N = makeTestDb(); // the account's library on the new phone, just created by the switch
      expect(await mergeWaits(D, N)).toBe(true); // the sign-in: the merge waits
      await sync(N); // the first full pull
      expect(await mergeWaits(D, N)).toBe(false);
      await mergeInto(N, D, S + 300);
      await settle([A, B, N]);
      const live = (await N.select().from(clientSchema.assets)).filter((row) => row.deletedAt === null);
      expect(live.map((row) => row.mediaLibraryAssetId)).toEqual(['camera-roll-1']);
    });

    // The iPhone's device library has its copy of camera-roll item x, a favorite with a note
    // (S+100). Later, the iPad (B) notes the account's photo of x and favorites it and takes that back
    // (S+200..S+220). At the sign-in on the iPhone, pass 1 into the account's library T1 merges the
    // device's photo into it at S+300 (the iPad's note, then the iPhone's; a favorite) and commits,
    // and T1 is lost before it pushes. The source learned nothing of pass 1, so the pass into the next
    // library T2 is an ordinary one, merging the photo at now (S+400): both notes and the favorite,
    // everywhere.
    it('a library lost before it pushed: the next pass merges what pass 1 did', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
      const D = makeTestDb(); // the iPhone's device library, before the sign-in
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.create(
        D,
        makeAssetRecord({
          ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'on-phone.jpg', isFileSynced: false },
          ...{ isFavorite: true, notes: 'from the iPhone' },
        }),
      );
      await edit(B, S + 200, () => repo.update(B, id, { notes: 'from the iPad' }));
      await edit(B, S + 210, () => repo.toggleFavorite(B, id));
      await edit(B, S + 220, () => repo.toggleFavorite(B, id));
      await sync(B);

      // Pass 1 into T1 after its first pull; T1 is lost before it pushes.
      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);
      expect(await localRow(T1, 'assets', id)).toMatchObject({
        notes: 'from the iPad\nfrom the iPhone',
        isFavorite: true,
      });

      const T2 = makeTestDb();
      await settle([A, B, T2]); // its first full pull
      await mergeInto(T2, D, S + 400);
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'from the iPad\nfrom the iPhone',
        isFavorite: true,
      });
    });

    // Pass 1 into T1 merges the iPhone's note into the account's photo of item x at S+300,
    // and T1 is lost before it pushes. The iPad then notes the photo, and favorites it and takes that
    // back (S+400..S+420). With T1 gone and no tokens, the device library is open again (libraryToOpen)
    // and the user edits the iPhone's photo at S+500: a new note, and a favorite. The pass into T2
    // (S+600) is an ordinary one: the photo as it is now, merged at now onto the iPad's edits.
    it('an edit made on the device after a lost pass beats an earlier edit of the account', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
      const D = makeTestDb();
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      const photo = await repo.create(
        D,
        makeAssetRecord({
          ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'on-phone.jpg', isFileSynced: false },
          ...{ isFavorite: false, notes: 'from the iPhone' },
        }),
      );

      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);

      await edit(B, S + 400, () => repo.update(B, id, { notes: 'from the iPad' }));
      await edit(B, S + 410, () => repo.toggleFavorite(B, id));
      await edit(B, S + 420, () => repo.toggleFavorite(B, id));
      await sync(B);
      await edit(D, S + 500, () => repo.update(D, photo.id, { notes: 'from the iPhone, later' }));
      await edit(D, S + 510, () => repo.toggleFavorite(D, photo.id));

      const T2 = makeTestDb();
      await settle([A, B, T2]);
      await mergeInto(T2, D, S + 600);
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'from the iPad\nfrom the iPhone, later',
        isFavorite: true,
      });
    });

    // Pass 1 into T1 merges the iPhone's photo of item x (a favorite, 'first') into the account's
    // photo at S+300; then the same item is imported again with a note (S+500), and the pass into T2
    // follows (S+600). `push` says whether T1 pushed pass 1 (and the source learned its marks) before
    // it was lost; `after` runs before the device's second import.
    async function importedAgainAfterPass1(push: boolean, after = async (_id: string) => {}) {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
      const D = makeTestDb();
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.create(
        D,
        makeAssetRecord({
          ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'on-phone.jpg', isFileSynced: false },
          ...{ isFavorite: true, notes: 'first' },
        }),
      );
      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);
      if (push) {
        await sync(T1);
        await finishPass(D, T1);
      }
      await after(id);
      at(S + 500);
      await repo.create(
        D,
        makeAssetRecord({
          ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'again.jpg', isFileSynced: false },
          notes: 'imported again',
        }),
      );
      const T2 = makeTestDb();
      await settle([A, B, T2]);
      await mergeInto(T2, D, S + 600);
      await settle([A, B, T2]);
      return expectConverged('assets', id, [A, B, T2]);
    }

    // T1 never pushed: the source learned nothing of pass 1, and the pass into T2 merges both photos.
    it('a photo imported again after a pass whose library never pushed keeps both notes', async () => {
      expect(await importedAgainAfterPass1(false)).toMatchObject({ notes: 'first\nimported again', isFavorite: true });
    });

    // T1 pushed 'first', and the iPad deleted the note later (S+400): pass 1's decision stands, so only
    // the new photo is merged, and the deleted note stays deleted.
    it('a photo imported again doesn’t bring back a note the account deleted after a pushed pass', async () => {
      const deleteOnIpad = async (id: string) => {
        await sync(B);
        await edit(B, S + 400, () => repo.update(B, id, { notes: null }));
        await sync(B);
      };
      expect(await importedAgainAfterPass1(true, deleteOnIpad)).toMatchObject({
        notes: 'imported again',
        isFavorite: true,
      });
    });

    // The iPhone holds three photos of item x: P1 (a favorite, 'one'), P2 ('two') and P3
    // ('three'). Pass 1 into T1 merges them into the account's photo (S+300), and T1 is lost before it
    // pushes. The iPhone then edits P2's note (S+400) and deletes P3 (S+410). The pass into T2 is an
    // ordinary one: what the photos hold now, merged at now.
    it('a library lost before it pushed: the next pass merges the photos as they are now', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
      const D = makeTestDb();
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      const photo = (filename: string, over: Partial<AssetRecord>) =>
        repo.create(
          D,
          makeAssetRecord({ mediaLibraryAssetId: 'camera-roll-x', filename, isFileSynced: false, ...over }),
        );
      await photo('p1.jpg', { isFavorite: true, notes: 'one' });
      const p2 = await photo('p2.jpg', { notes: 'two' });
      const p3 = await photo('p3.jpg', { notes: 'three' });
      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);
      expect(await localRow(T1, 'assets', id)).toMatchObject({ notes: 'one\ntwo\nthree', isFavorite: true });

      await edit(D, S + 400, () => repo.update(D, p2.id, { notes: 'two, later' }));
      await edit(D, S + 410, () => repo.remove(D, [p3.id]));
      const T2 = makeTestDb();
      await settle([A, B, T2]);
      await commitPass(D, T2, S + 500);
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'one\ntwo, later',
        isFavorite: true,
      });
    });

    // D holds the account's photo by id (an earlier library's pass copied it and pushed it,
    // then that library was lost; as in deviceLibraryWith). Opened again while the session had no
    // tokens, D notes the photo (S+100). Pass 1 into T1 replays that note onto T1's row (by id) and
    // commits; T1 is lost before it pushes. The pass into T2 (whose first pull brought the photo
    // without the note) is an ordinary one: the note replays, and reaches the account.
    it('an edit replayed by id into a library lost before it pushed is replayed again', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      await edit(D, S + 100, () => repo.update(D, id, { notes: 'device' }));

      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);
      expect(await localRow(T1, 'assets', id)).toMatchObject({ notes: 'device' });

      const T2 = makeTestDb();
      await settle([A, B, T2]);
      await mergeInto(T2, D, S + 400);
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({ notes: 'device' });
    });

    // D holds the account's photo X of camera-roll item x by id (as in deviceLibraryWith), and
    // the same item imported again as P (S+100). Pass 1 into T1 matches P into X (S+300) and commits;
    // T1 is lost before it pushes. Opened again, D favorites X (S+500). The pass into T2 replays the
    // device's favorite (by id) and merges P into X onto it.
    it('a match into a record the device also edited by id keeps that edit', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: 'orig', isFavorite: false });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.create(
        D,
        makeAssetRecord({
          mediaLibraryAssetId: 'camera-roll-x',
          filename: 'again.jpg',
          isFileSynced: false,
          notes: 'imported again',
        }),
      );

      const T1 = makeTestDb();
      await sync(T1);
      await commitPass(D, T1, S + 300);
      expect(await localRow(T1, 'assets', id)).toMatchObject({ notes: 'orig\nimported again' });

      await edit(D, S + 500, () => repo.toggleFavorite(D, id));
      const T2 = makeTestDb();
      await settle([A, B, T2]);
      await mergeInto(T2, D, S + 600);
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'orig\nimported again',
        isFavorite: true,
      });
    });

    // D holds the account's photo X of camera-roll item x by id (as in deviceLibraryWith),
    // and the same item imported again as P with a note (imports don't dedupe). The user deletes the
    // duplicate X on the device and keeps P. The merge plans P as a match of X (live in the account at
    // plan time) and replays X's deletion by id. A match goes only into a record still live once the
    // plan's own replays apply, so P is copied: a live photo of item x with P's note.
    it('a photo kept on the device isn’t merged into its duplicate the device deleted', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.create(
        D,
        makeAssetRecord({ mediaLibraryAssetId: 'camera-roll-x', filename: 'kept.jpg', isFileSynced: false }),
      );
      await edit(D, S + 150, async () => {
        const [kept] = (await D.select().from(clientSchema.assets)).filter((row) => row.id !== id);
        await repo.update(D, kept!.id, { notes: 'the one I kept' });
      });
      await edit(D, S + 200, () => repo.remove(D, [id]));

      await mergeInto(A, D, S + 300);
      await settle();

      const live = (await A.select().from(clientSchema.assets)).filter((row) => row.deletedAt === null);
      expect(live.map((row) => [row.mediaLibraryAssetId, row.notes])).toEqual([['camera-roll-x', 'the one I kept']]);
    });

    it('a device purge older than the account’s pending restore loses to it everywhere', async () => {
      const id = await seedAsset();
      await edit(A, S + 50, () => repo.remove(A, [id]));
      await settle();
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.purgeAssets(D, [id]));
      await edit(A, S + 200, () => repo.updateAll(A, [id], { deletedAt: null }));
      await mergeInto(A, D, S + 300);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
    });
  });
});
