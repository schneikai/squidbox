import { useNavigation } from '@react-navigation/native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import getAssetsByIds from '@/utils/assets/queries/getAssetsByIds';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

// What an asset grid with select mode does with a tap and with the selection. `selection` comes from
// useToggleSelectAssetsAction; `assetIds` are the ids shown.
export default function useAssetSelectionActions(selection, assetIds) {
  const { isSelectMode, selectedAssetIds, toggleSelectAsset, selectAssets, exitSelectMode } = selection;
  const navigation = useNavigation();
  const { assets } = useAssets();
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  function getSelectedAssets() {
    return getAssetsByIds(assets, selectedAssetIds);
  }

  const allSelected = assetIds.length > 0 && selectedAssetIds.length === assetIds.length;

  return {
    hasSelection: selectedAssetIds.length > 0,
    allSelected,
    getSelectedAssets,
    openAsset(asset) {
      if (isSelectMode) toggleSelectAsset(asset.id);
      else navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    },
    toggleSelectAll() {
      selectAssets(allSelected ? [] : assetIds);
    },
    async downloadSelected() {
      await saveAssetsToMediaLibraryAsync(getSelectedAssets());
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
