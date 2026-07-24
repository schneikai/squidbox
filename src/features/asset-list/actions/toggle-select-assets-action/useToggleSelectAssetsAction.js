import { useState } from 'react';

export default function useToggleSelectAssetsAction() {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  function toggleSelectMode() {
    setIsSelectMode((isSelectMode) => {
      if (isSelectMode) {
        setSelectedAssetIds([]);
      }
      return !isSelectMode;
    });
  }

  function toggleSelectAsset(assetId) {
    setSelectedAssetIds((selectedAssetIds) => {
      if (selectedAssetIds.includes(assetId)) {
        return selectedAssetIds.filter((id) => id !== assetId);
      } else {
        return [...selectedAssetIds, assetId];
      }
    });
  }

  function selectAssets(assetIds) {
    setSelectedAssetIds(assetIds);
  }

  return {
    isSelectMode,
    selectedAssetIds,
    toggleSelectMode,
    toggleSelectAsset,
    selectAssets,
  };
}
