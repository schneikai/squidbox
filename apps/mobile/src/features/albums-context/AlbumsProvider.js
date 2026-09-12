import { useMemo } from 'react';

import AlbumsContext from './AlbumsContext';

import { getDb, schema } from '@/sync/db/client';
import { orderedAssetsByAlbum, deriveAlbumPostHistory } from '@/sync/derive';
import { makeEdgeRepository } from '@/sync/edgesRepository';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { requestSync } from '@/sync/worker';
import albumSchema from '@/utils/albums/albumSchema';
import getNewItemId from '@/utils/getNewItemId';

// SQLite-backed albums store. Membership lives in the album_assets edge collection (add/remove/
// reorder are independent edge writes that don't clobber across devices); `assets`, `postHistory`
// and `lastPostedAt` are synthesized/derived here so consumers keep seeing the old record shape.
// Only mounted after the initial pull finishes (see AppGate), so it always reads the full library.
const repo = makeRepository('albums', schema.albums);
const edges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

export default function AlbumsProvider({ children }) {
  const albumRows = useLiveCollectionMap(schema.albums);
  const albumEdges = useLiveCollectionRows(schema.albumAssets);
  const postEdges = useLiveCollectionRows(schema.postAssets);
  const posts = useLiveCollectionMap(schema.posts);

  // Synthesize the ordered `assets` array + derived post history onto each album record.
  const albums = useMemo(() => {
    const assetsByAlbum = orderedAssetsByAlbum(albumEdges);
    const { historyById, lastPostedAtById } = deriveAlbumPostHistory(posts, postEdges, albumEdges);
    const out = {};
    for (const [id, row] of Object.entries(albumRows)) {
      out[id] = {
        ...row,
        assets: assetsByAlbum[id] ?? [],
        postHistory: historyById[id] ?? [],
        lastPostedAt: lastPostedAtById[id] ?? null,
      };
    }
    return out;
  }, [albumRows, albumEdges, postEdges, posts]);

  const value = useMemo(() => {
    const db = getDb();
    function updateAlbums(ids, updates) {
      for (const id of ids) repo.update(db, id, toModernChanges(updates));
      requestSync();
    }
    return {
      albums,
      loadAlbumsAsync: async () => {},
      addAlbum: async (data) => {
        const casted = albumSchema.cast(data);
        const assetIds = casted.assets ?? [];
        const rec = repo.create(db, toModernRecord(casted)); // `assets` stripped by toModernRecord
        if (assetIds.length) edges.add(db, rec.id, assetIds, getNewItemId);
        requestSync();
        return rec;
      },
      updateAlbum: async (id, updates) => updateAlbums([id], updates),
      updateAlbums: async (ids, updates) => updateAlbums(ids, updates),
      updateManyAlbums: async (updatesById) => {
        for (const [id, updates] of Object.entries(updatesById)) repo.update(db, id, toModernChanges(updates));
        requestSync();
      },
      toggleFavoriteAlbum: async (album) => updateAlbums([album.id], { isFavorite: !album.isFavorite }),
      addAssetsToAlbum: async (album, assetsOrAssetIds) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        edges.add(db, album.id, assetIds, getNewItemId);
        requestSync();
      },
      removeAssetsFromAlbum: async (album, assetsOrAssetIds) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        edges.remove(db, album.id, assetIds);
        requestSync();
      },
      reorderAlbumAssets: async (album, orderedAssetIds) => {
        edges.reorder(db, album.id, orderedAssetIds);
        repo.update(db, album.id, { sortOrder: 'custom' });
        requestSync();
      },
      setAlbumDeleted: async (album) => {
        repo.remove(db, [album.id]);
        edges.tombstoneParent(db, album.id);
        requestSync();
      },
      deleteAlbumAsync: async (album) => {
        repo.remove(db, [album.id]);
        edges.tombstoneParent(db, album.id);
        requestSync();
      },
    };
  }, [albums]);

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
