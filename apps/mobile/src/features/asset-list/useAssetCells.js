import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';
import createSelectionStore from './createSelectionStore';

import AssetQuickViewModal from '@/components/AssetQuickViewModal';
import useAssets from '@/features/assets-context/useAssets';

/**
 * Everything an asset grid needs for its cells: `renderCell` (its `renderListItem`) and the
 * `quickViewModal` to render next to it. Cells favorite on double tap (not deleted assets) and peek on
 * long press (not in select mode, or with `canPeek` off). The handlers reach the cells through a ref, so they keep their identity across renders
 * and the memoized cells skip re-rendering unless their own asset, selection or display props change.
 */
export default function useAssetCells({
  onPress,
  isSelectMode = false,
  isAssetSelected,
  showLastPostedAt = false,
  canPeek = true,
}) {
  const { toggleFavoriteAsset } = useAssets();
  const quickViewRef = useRef(null);

  const handlersRef = useRef();
  handlersRef.current = { onPress, onDoublePress: toggleFavoriteAsset, isSelectMode };
  const [stable] = useState(() => ({
    onPress: (asset) => handlersRef.current.onPress(asset),
    onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
    onLongPress: (asset) => !handlersRef.current.isSelectMode && quickViewRef.current?.open(asset),
    onLongPressOut: () => quickViewRef.current?.close(),
  }));
  const hasPress = !!onPress;

  // Select mode reaches the cells through the store, so renderCell keeps its identity and a toggle
  // re-renders only the selection overlays. Before paint, so the rings show in the same frame.
  const [selection] = useState(createSelectionStore);
  useLayoutEffect(() => selection.set({ isSelectMode, isAssetSelected }), [selection, isSelectMode, isAssetSelected]);

  const renderCell = useCallback(
    (asset) => (
      <AssetGridCell
        asset={asset}
        selection={selection}
        showLastPostedAt={showLastPostedAt}
        onPress={hasPress ? stable.onPress : undefined}
        onDoublePress={asset.deletedAt ? undefined : stable.onDoublePress}
        onLongPress={canPeek ? stable.onLongPress : undefined}
        onLongPressOut={stable.onLongPressOut}
      />
    ),
    [selection, showLastPostedAt, hasPress, canPeek, stable],
  );

  return { renderCell, quickViewModal: <AssetQuickViewModal ref={quickViewRef} /> };
}
