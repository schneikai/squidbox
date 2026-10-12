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

  const value = useMemo(() => {
    const db = getDb();
    async function deleteAlbum(id) {
      await repo.remove(db, [id]);
      await edges.tombstoneParent(db, id);
      requestSync();
    }
    async function updateAlbums(ids, updates) {
      const changes = toModernChanges(updates);
      await repo.updateMany(db, Object.fromEntries(ids.map((id) => [id, changes])));
      requestSync();
    }
    return {
      albums,
      addAlbum: async (data) => {
        const casted = albumSchema.cast(data);
        const assetIds = casted.assets ?? [];
        const rec = await repo.create(db, toModernRecord(casted)); // `assets` stripped by toModernRecord
        if (assetIds.length) await edges.add(db, rec.id, assetIds, getNewItemId);
        requestSync();
        return rec;
      },
      updateAlbum: async (id, updates) => updateAlbums([id], updates),
      updateAlbums: async (ids, updates) => updateAlbums(ids, updates),
      updateManyAlbums: async (updatesById) => {
        const changesById = Object.entries(updatesById).map(([id, updates]) => [id, toModernChanges(updates)]);
        await repo.updateMany(db, Object.fromEntries(changesById));
        requestSync();
      },
      toggleFavoriteAlbum: async (album) => updateAlbums([album.id], { isFavorite: !album.isFavorite }),
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
        await edges.reorder(db, album.id, orderedAssetIds);
        await repo.update(db, album.id, { sortOrder: 'custom' });
        requestSync();
      },
      setAlbumDeleted: async (album) => deleteAlbum(album.id),
      deleteAlbumAsync: async (album) => deleteAlbum(album.id),
    };
  }, [albums]);

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
