import { useMemo } from 'react';

import AlbumsContext from './AlbumsContext';

import { getDb, schema } from '@/sync/db/client';
import { toModernRecord, toModernChanges } from '@/sync/legacyBase';
import { makeRepository } from '@/sync/repository';
import { useLiveCollectionMap } from '@/sync/useCollection';
import { requestSync } from '@/sync/worker';
import albumSchema from '@/utils/albums/albumSchema';

// SQLite-backed albums store. Same provider API; writes go through the generic repository +
// sync worker. The DB is migrated by AssetsProvider (which wraps this). Legacy album objects
// are normalized via the yup schema (defaults) then mapped to the modern shape (deletedAt).
const repo = makeRepository('albums', schema.albums);

export default function AlbumsProvider({ children }) {
  const albums = useLiveCollectionMap(schema.albums);

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
        const rec = repo.create(db, toModernRecord(albumSchema.cast(data)));
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
        updateAlbums([album.id], { assets: [...new Set([...album.assets, ...assetIds])] });
      },
      removeAssetsFromAlbum: async (album, assetsOrAssetIds) => {
        const assetIds = assetsOrAssetIds.map((a) => (typeof a === 'string' ? a : a.id));
        updateAlbums([album.id], { assets: album.assets.filter((id) => !assetIds.includes(id)) });
      },
      reorderAlbumAssets: async (album, orderedAssetIds) => {
        updateAlbums([album.id], { assets: [...new Set(orderedAssetIds)], sortOrder: 'custom' });
      },
      setAlbumDeleted: async (album) => {
        repo.remove(db, [album.id]);
        requestSync();
      },
      deleteAlbumAsync: async (album) => {
        repo.remove(db, [album.id]);
        requestSync();
      },
    };
  }, [albums]);

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
