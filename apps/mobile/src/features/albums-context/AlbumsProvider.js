import { useMemo } from 'react';

import AlbumsContext from './AlbumsContext';

import assetQuery from '@/features/asset-list/assetQuery';
import { getDb, schema } from '@/sync/db/client';
import { orderedAssetsByAlbum, deriveAlbumPostHistory } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { useDerivedRecords } from '@/sync/useDerivedRecords';
import { requestSync } from '@/sync/worker';
import { writeInBatches } from '@/sync/writeInBatches';
import albumSchema from '@/utils/albums/albumSchema';
import getNewItemId from '@/utils/getNewItemId';

// SQLite-backed albums store. Membership lives in the album_assets edge collection (add/remove/
// reorder are independent edge writes that don't clobber across devices); `assets`, `postHistory`
// and `lastPostedAt` are synthesized/derived here so consumers keep seeing the old record shape.
// Only mounted after the initial pull finishes (see AppGate), so it always reads the full library.
const repo = makeRepository('albums', schema.albums);
const edges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

const NONE = [];

export default function AlbumsProvider({ children }) {
  const albumRows = useLiveCollectionRows(schema.albums);
  const albumEdges = useLiveCollectionRows(schema.albumAssets);
  const postEdges = useLiveCollectionRows(schema.postAssets);
  const posts = useLiveCollectionMap(schema.posts);

  // Synthesize the ordered `assets` array + derived post history onto each album record.
  const albumExtrasOf = useMemo(() => {
    const assetsByAlbum = orderedAssetsByAlbum(albumEdges);
    const { historyById, lastPostedAtById } = deriveAlbumPostHistory(posts, postEdges, albumEdges);
    return (row) => ({
      assets: assetsByAlbum[row.id] ?? NONE,
      postHistory: historyById[row.id] ?? NONE,
      lastPostedAt: lastPostedAtById[row.id] ?? null,
    });
  }, [albumEdges, postEdges, posts]);
  const albums = useDerivedRecords(albumRows, albumExtrasOf);

  // A user action that writes the album and its edges commits once (repository transactions inside
  // `tx` become savepoints), so readers never see half of it.
  const value = useMemo(() => {
    const db = getDb();
    async function updateAlbum(id, updates) {
      await repo.update(db, id, toModernChanges(updates));
      requestSync();
    }
    return {
      albums,
      addAlbum: async (data) => {
        const casted = albumSchema.cast(data);
        const assetIds = casted.assets ?? [];
        const rec = await db.transaction(async (tx) => {
          const created = await repo.create(tx, toModernRecord(casted)); // `assets` stripped by toModernRecord
          if (assetIds.length) await edges.add(tx, created.id, assetIds, getNewItemId);
          return created;
        });
        requestSync();
        return rec;
      },
      updateAlbum,
      updateManyAlbums: async (updatesById) => {
        const changesById = Object.entries(updatesById).map(([id, updates]) => [id, toModernChanges(updates)]);
        await repo.updateMany(db, Object.fromEntries(changesById));
        requestSync();
      },
      toggleFavoriteAlbum: async (album) => {
        await repo.toggle(db, album.id, 'isFavorite');
        requestSync();
      },
      // Both take the batch options of writeInBatches ({ onProgress, isCancelled }).
      addAssetsToAlbum: async (album, assetsOrAssetIds, batchOptions) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        await writeInBatches(assetIds, (ids) => edges.add(db, album.id, ids, getNewItemId), batchOptions);
        requestSync();
      },
      removeAssetsFromAlbum: async (album, assetsOrAssetIds, batchOptions) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        await writeInBatches(assetIds, (ids) => edges.remove(db, album.id, ids), batchOptions);
        requestSync();
      },
      // A drag under a date sort adopts the order on screen (`sort`) and puts the album on custom
      // order; from then on each drag is one edge write. `afterId: null` drops at the front.
      reorderAlbumAssets: async (album, { assetId, afterId, sort }) => {
        await db.transaction(async (tx) => {
          if (sort !== 'custom') {
            await edges.reorder(tx, album.id, await assetQuery({ scope: { albumId: album.id }, sort }).ids(tx));
          }
          await edges.move(tx, album.id, assetId, afterId);
          if (album.sortOrder !== 'custom') await repo.update(tx, album.id, { sortOrder: 'custom' });
        });
        requestSync();
      },
      setAlbumDeleted: async (album) => {
        await db.transaction(async (tx) => {
          await repo.remove(tx, [album.id]);
          await edges.tombstoneParent(tx, album.id);
        });
        requestSync();
      },
    };
  }, [albums]);

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
