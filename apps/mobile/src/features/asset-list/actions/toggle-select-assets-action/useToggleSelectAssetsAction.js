import { useCallback, useMemo, useState } from 'react';

// Select mode and the selected asset ids. The functions keep their identity, so the drag-select
// gesture isn't rebuilt mid-drag when the selection changes.
export default function useToggleSelectAssetsAction() {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const selectedIds = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((isOn) => !isOn);
    setSelectedAssetIds([]);
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedAssetIds([]);
  }, []);

  const toggleSelectAsset = useCallback((assetId) => {
    setSelectedAssetIds((ids) => (ids.includes(assetId) ? ids.filter((id) => id !== assetId) : [...ids, assetId]));
  }, []);

  const selectAssets = useCallback((assetIds) => setSelectedAssetIds(assetIds), []);

  const isAssetSelected = useCallback((assetId) => selectedIds.has(assetId), [selectedIds]);

  // Memoized, so a provider can pass it on without re-rendering its consumers on every render.
  return useMemo(
    () => ({
      isSelectMode,
      selectedAssetIds,
      isAssetSelected,
      toggleSelectMode,
      exitSelectMode,
      toggleSelectAsset,
      selectAssets,
    }),
    [
      isSelectMode,
      selectedAssetIds,
      isAssetSelected,
      toggleSelectMode,
      exitSelectMode,
      toggleSelectAsset,
      selectAssets,
    ],
  );
}
