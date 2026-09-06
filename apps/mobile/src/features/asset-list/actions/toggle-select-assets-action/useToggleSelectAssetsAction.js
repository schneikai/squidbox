import { useCallback, useState } from 'react';

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

  // Stable identity so the drag-select gesture isn't rebuilt mid-drag when the
  // selection changes and re-renders the album screen.
  const selectAssets = useCallback((assetIds) => {
    setSelectedAssetIds(assetIds);
  }, []);

  return {
    isSelectMode,
    selectedAssetIds,
    toggleSelectMode,
    toggleSelectAsset,
    selectAssets,
  };
}
