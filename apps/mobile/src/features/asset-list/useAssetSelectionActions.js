import { useNavigation } from '@react-navigation/native';

import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

// What an asset grid with select mode does with a tap and with the selection. `selection` comes from
// useToggleSelectAssetsAction; `query` is the grid's assetQuery and `count` how many assets it shows.
export default function useAssetSelectionActions(selection, query, count) {
  const { isSelectMode, selectedAssetIds, toggleSelectAsset, selectAssets, exitSelectMode } = selection;
  const navigation = useNavigation();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();

  const allSelected = count > 0 && selectedAssetIds.length === count;

  return {
    hasSelection: selectedAssetIds.length > 0,
    allSelected,
    openAsset(asset) {
      if (isSelectMode) toggleSelectAsset(asset.id);
      else navigation.navigate('AssetScreen', { assetId: asset.id, query: query.descriptor });
    },
    // Exactly what the grid shows, however many: the count and the selection always agree.
    async toggleSelectAll() {
      selectAssets(allSelected ? [] : await query.ids(getDb()));
    },
    async downloadSelected() {
      await saveAssetsToMediaLibraryAsync(await readByIds(getDb(), schema.assets, selectedAssetIds));
    },
    addSelectedToAlbum() {
      navigation.navigate('AddToAlbumModal', { assetIds: selectedAssetIds });
      exitSelectMode();
    },
    postSelected() {
      navigation.navigate('AddEditPostModal', { assetIds: selectedAssetIds });
      exitSelectMode();
    },
  };
}
