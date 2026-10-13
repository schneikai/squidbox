import { useNavigation } from '@react-navigation/native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import getAssetsByIds from '@/utils/assets/queries/getAssetsByIds';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

// What an asset grid with select mode does with a tap and with the selection. `selection` comes from
// useToggleSelectAssetsAction (or the floating bars, which use it); `assetIds` are the ids shown.
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

  return {
    allSelected: assetIds.length > 0 && selectedAssetIds.length === assetIds.length,
    getSelectedAssets,
    openAsset(asset) {
      if (isSelectMode) toggleSelectAsset(asset.id);
      else navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    },
    toggleSelectAll() {
      selectAssets(selectedAssetIds.length === assetIds.length ? [] : assetIds);
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
