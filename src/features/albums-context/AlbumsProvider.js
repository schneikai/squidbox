import AlbumsContext from './AlbumsContext';

import albumSchema from '@/utils/albums/albumSchema';
import loadAlbumsAsync from '@/utils/albums/loadAlbumsAsync';
import useLoadAndUpdateData from '@/utils/local-data/useLoadAndUpdateData';
import addAsync from '@/utils/state/addAsync';
import deleteAsync from '@/utils/state/deleteAsync';
import getModelsById from '@/utils/state/getModelsById';
import updateAsync from '@/utils/state/updateAsync';

export default function AlbumsProvider({ children }) {
  const {
    data: albums,
    setData: setAlbums,
    initializeData,
  } = useLoadAndUpdateData({ localDataFilename: 'albums.json' });

  async function updateAlbums(ids, updates) {
    updateAsync({
      models: getModelsById(ids, albums),
      updates,
      schema: albumSchema,
      setState: setAlbums,
    });
  }

  const value = {
    albums,
    loadAlbumsAsync: async () => {
      const albums = await loadAlbumsAsync();
      initializeData(albums);
    },
    addAlbum: async (data) => {
      return await addAsync({
        data,
        schema: albumSchema,
        setState: setAlbums,
      });
    },
    updateAlbum: async (id, updates) => {
      await updateAlbums([id], updates);
    },
    updateAlbums: async (ids, updates) => {
      await updateAlbums(ids, updates);
    },
    toggleFavoriteAlbum: async (album) => {
      const isFavorite = !album.isFavorite;
      await updateAlbums([album.id], { isFavorite });
    },
    addAssetsToAlbum: async (album, assetsOrAssetIds) => {
      const assetIds = assetsOrAssetIds.map((assetOrAssetId) =>
        typeof assetOrAssetId === 'string' ? assetOrAssetId : assetOrAssetId.id,
      );
      const updatedAssets = [...album.assets, ...assetIds];
      await updateAlbums([album.id], { assets: updatedAssets });
    },
    removeAssetsFromAlbum: async (album, assetsOrAssetIds) => {
      const assetIds = assetsOrAssetIds.map((assetOrAssetId) =>
        typeof assetOrAssetId === 'string' ? assetOrAssetId : assetOrAssetId.id,
      );
      const updatedAssets = album.assets.filter((assetId) => !assetIds.includes(assetId));
      await updateAlbums([album.id], { assets: updatedAssets });
    },
    setAlbumDeleted: async (album) => {
      await updateAlbums([album.id], { isDeleted: true });
    },
    deleteAlbumAsync: async (album) => {
      await deleteAsync({ ids: [album.id], setState: setAlbums });
    },
  };

  return <AlbumsContext.Provider value={value}>{children}</AlbumsContext.Provider>;
}
