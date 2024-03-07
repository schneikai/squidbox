import AssetsContext from './AssetsContext';

import deleteAssetFilesAsync from '@/features/cloud/assets/deleteAssetFilesAsync';
import assetSchema from '@/utils/assets/assetSchema';
import loadAssetsAsync from '@/utils/assets/loadAssetsAsync';
import useLoadAndUpdateData from '@/utils/local-data/useLoadAndUpdateData';
import addAsync from '@/utils/state/addAsync';
import deleteAsync from '@/utils/state/deleteAsync';
import getModelsById from '@/utils/state/getModelsById';
import updateAsync from '@/utils/state/updateAsync';

export default function AssetsProvider({ children }) {
  const {
    data: assets,
    setData: setAssets,
    initializeData,
  } = useLoadAndUpdateData({ localDataFilename: 'assets.json' });

  async function updateAssets(ids, updates) {
    updateAsync({
      models: getModelsById(ids, assets),
      updates,
      schema: assetSchema,
      setState: setAssets,
    });
  }

  // TODO: We need to update AssetsProvier, AlbumsProvider and PostsProvider
  // and rename all methods to [methodName]Async to indicate that they are async.
  // All code where these methods are used need to be updated as well.
  // I would also like to update all methods to use the object instead of just the id.
  // Right now we sometimes use id and sometimes the object. This is confusing.

  const value = {
    assets,
    loadAssetsAsync: async () => {
      const assets = await loadAssetsAsync();
      initializeData(assets);
    },
    addAssetAsync: async (data) => {
      return await addAsync({
        data,
        schema: assetSchema,
        setState: setAssets,
      });
    },
    addAssetsAsync: async (data) => {
      return await addAsync({
        data,
        schema: assetSchema,
        setState: setAssets,
      });
    },
    updateAsset: async (id, updates) => {
      await updateAssets([id], updates);
    },
    updateAssets: async (ids, updates) => {
      await updateAssets(ids, updates);
    },
    toggleFavoriteAsset: async (asset) => {
      const isFavorite = !asset.isFavorite;
      await updateAssets([asset.id], { isFavorite });
    },
    setAssetsDeleted: async (assetIds) => {
      await updateAssets(assetIds, { isDeleted: true });
    },
    restoreDeletedAssets: async (assetIds) => {
      await updateAssets(assetIds, { isDeleted: false });
    },
    deleteAssetsAsync: async (assetsToDelete) => {
      // TODO: If we are dealing with a cloud asset here (isSynced) we need to
      // add a check if cloud is authorized and if there is internet connection.
      await deleteAssetFilesAsync(assetsToDelete);
      await deleteAsync({ ids: assetsToDelete.map((asset) => asset.id), setState: setAssets });
    },
  };

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}
