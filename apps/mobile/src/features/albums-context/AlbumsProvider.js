import { albumCollection } from '@squidbox/shared';
import { useMemo } from 'react';

import AlbumsContext from './AlbumsContext';
import moveAlbum from './moveAlbum';

import assetQuery from '@/features/asset-list/assetQuery';
import { getDb, schema } from '@/sync/db/client';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { makeRepository } from '@/sync/repository';
import { requestSync } from '@/sync/worker';
import { writeInBatches } from '@/sync/writeInBatches';
import getNewItemId from '@/utils/getNewItemId';
import newRecord from '@/utils/newRecord';

// The album writes. Membership lives in the album_assets edge collection (add/remove/reorder are
// independent edge writes that don't clobber across devices). Screens read albums through their
// own live queries (albumQuery, readByIds).
const repo = makeRepository('albums', schema.albums);
const edges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

// A new album isn't on Custom order (no `sortOrder`) and has no place in the albums' custom order yet.
const ALBUM_DEFAULTS = {
  name: 'New Album',
  isFavorite: false,
  archivedAt: null,
  showInPostSuggestionsAfter: null,
  oldCollectionName: null,
  notes: null,
  sortOrder: null,
  smartAlbumType: null,
};

export default function AlbumsProvider({ children }) {
  // A user action that writes the album and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    // `shouldSync: false` leaves the sync to the caller (an editor saving as you type syncs when you
    // leave it).
    async function updateAlbum(id, updates, { shouldSync = true } = {}) {
      await repo.update(db, id, updates);
      if (shouldSync) requestSync();
    }
    return {
      addAlbum: async ({ assets: assetIds = [], ...fields }) => {
        const rec = await db.transaction(async (tx) => {
          const created = await repo.create(tx, newRecord(albumCollection, ALBUM_DEFAULTS, fields));
          if (assetIds.length) await edges.add(tx, created.id, assetIds, getNewItemId);
          return created;
        });
        requestSync();
        return rec;
      },
      updateAlbum,
      updateManyAlbums: async (updatesById) => {
        await repo.updateMany(db, updatesById);
        requestSync();
      },
      // A drag in the albums list under `sort` (see moveAlbum): `afterId: null` drops at the front.
      // Resolves to the write's committed-write count, as moveAlbum.
      moveAlbum: async (change) => {
        const writtenAt = await moveAlbum(db, repo, change);
        requestSync();
        return writtenAt;
      },
      toggleFavoriteAlbum: async (album) => {
        await repo.toggle(db, album.id, 'isFavorite');
        requestSync();
      },
      // Both take the batch options of writeInBatches ({ onProgress, signal }) and resolve to whether
      // every batch was written.
      addAssetsToAlbum: async (album, assetsOrAssetIds, batchOptions) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        return writeInBatches(assetIds, (ids) => edges.add(db, album.id, ids, getNewItemId), batchOptions);
      },
      removeAssetsFromAlbum: async (album, assetIds, batchOptions) =>
        writeInBatches(assetIds, (ids) => edges.remove(db, album.id, ids), batchOptions),
      // A drag under a date sort adopts the order on screen (`sort`) and puts the album on custom
      // order; from then on each drag is one edge write. `afterId: null` drops at the front. Resolves
      // to the write's committed-write count (AppDb.committedWrites), read before anything else runs.
      reorderAlbumAssets: async (album, { assetId, afterId, sort }) => {
        await db.transaction(async (tx) => {
          if (sort !== 'custom') {
            await edges.reorder(tx, album.id, await assetQuery({ scope: { albumId: album.id }, sort }).ids(tx));
          }
          await edges.move(tx, album.id, assetId, afterId);
          if (album.sortOrder !== 'custom') await repo.update(tx, album.id, { sortOrder: 'custom' });
        });
        const writtenAt = db.committedWrites();
        requestSync();
        return writtenAt;
      },
      setAlbumDeleted: async (album) => {
        await db.transaction(async (tx) => {
          await repo.remove(tx, [album.id]);
          await edges.tombstoneParent(tx, album.id);
        });
        requestSync();
      },
    };
  }, []);

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
