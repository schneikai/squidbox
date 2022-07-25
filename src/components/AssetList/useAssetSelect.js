import { useState } from "react";

export default function useAssetSelect(initialSelectMode = false) {
  const [isSelectMode, setIsSelectMode] = useState(initialSelectMode);
  const [selectedAssets, setSelectedAssets] = useState([]);

  function toggleSelectMode() {
    setIsSelectMode((isSelectMode) => {
      if (isSelectMode) {
        setSelectedAssets([]);
      }
      return !isSelectMode;
    });
  }

  function findSelectedAssetIndex(asset) {
    return selectedAssets.findIndex((x) => x.id === asset.id);
  }

  function toggleSelectAsset(asset) {
    const index = findSelectedAssetIndex(asset);
    if (index > -1) {
      setSelectedAssets((selectedAssets) => {
        selectedAssets.splice(index, 1);
        return [...selectedAssets];
      });
    } else {
      setSelectedAssets((selectedAssets) => [...selectedAssets, asset]);
    }
  }

  function isAssetSelected(asset) {
    return findSelectedAssetIndex(asset) > -1;
  }

  return { isSelectMode, toggleSelectMode, isAssetSelected, toggleSelectAsset, selectedAssets };
}
