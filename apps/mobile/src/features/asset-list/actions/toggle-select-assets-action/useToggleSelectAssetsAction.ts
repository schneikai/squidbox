import { useCallback, useMemo, useState } from 'react';

/** An asset grid's select mode and selection, and what changes them. */
export type AssetSelection = {
  isSelectMode: boolean;
  selectedAssetIds: string[];
  isAssetSelected: (assetId: string) => boolean;
  toggleSelectMode: () => void;
  exitSelectMode: () => void;
  toggleSelectAsset: (assetId: string) => void;
  selectAssets: (assetIds: string[]) => void;
};

// Select mode and the selected asset ids. The functions keep their identity, so the drag-select
// gesture isn't rebuilt mid-drag when the selection changes.
export default function useToggleSelectAssetsAction(): AssetSelection {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const selectedIds = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((isOn) => !isOn);
    setSelectedAssetIds([]);
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedAssetIds([]);
  }, []);

  const toggleSelectAsset = useCallback((assetId: string) => {
    setSelectedAssetIds((ids) => (ids.includes(assetId) ? ids.filter((id) => id !== assetId) : [...ids, assetId]));
  }, []);

  const selectAssets = useCallback((assetIds: string[]) => setSelectedAssetIds(assetIds), []);

  const isAssetSelected = useCallback((assetId: string) => selectedIds.has(assetId), [selectedIds]);

  // Memoized, so a provider can pass it on without re-rendering its consumers on every render.
  return useMemo<AssetSelection>(
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
