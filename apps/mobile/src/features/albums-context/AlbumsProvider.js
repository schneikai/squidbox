import { useMemo } from 'react';

import AlbumsContext from './AlbumsContext';

import { getDb, schema } from '@/sync/db/client';
import { orderedAssetsByAlbum, deriveAlbumPostHistory } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { useDerivedRecords } from '@/sync/useDerivedRecords';
import { requestSync } from '@/sync/worker';
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
      addAssetsToAlbum: async (album, assetsOrAssetIds) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        await edges.add(db, album.id, assetIds, getNewItemId);
        requestSync();
      },
      removeAssetsFromAlbum: async (album, assetsOrAssetIds) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        await edges.remove(db, album.id, assetIds);
        requestSync();
      },
      reorderAlbumAssets: async (album, orderedAssetIds) => {
        await db.transaction(async (tx) => {
          await edges.reorder(tx, album.id, orderedAssetIds);
          await repo.update(tx, album.id, { sortOrder: 'custom' });
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
