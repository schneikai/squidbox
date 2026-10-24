import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';
import createSelectionStore from './createSelectionStore';

import AssetQuickViewModal from '@/components/AssetQuickViewModal';
import useAssets from '@/features/assets-context/useAssets';
import useHaptics from '@/hooks/useHaptics';

/**
 * Everything an asset grid needs for its cells: `renderCell` (its `renderListItem`) and the
 * `quickViewModal` to render next to it. Cells favorite on double tap (not deleted assets) and peek on
 * long press (not in select mode, or with `canPeek` off: a grid whose long press drags peeks itself,
 * through `peek(asset)` and `endPeek()`). The handlers reach the cells through a ref, so they keep
 * their identity across renders and the memoized cells skip re-rendering unless their own asset,
 * selection or display props change.
 */
export default function useAssetCells({ onPress, isSelectMode = false, isAssetSelected, canPeek = true }) {
  const { toggleFavoriteAsset } = useAssets();
  const haptics = useHaptics();
  const quickViewRef = useRef(null);

  const handlersRef = useRef();
  handlersRef.current = { onPress, onDoublePress: toggleFavoriteAsset, isSelectMode, haptics };
  const [stable] = useState(() => {
    function peek(asset) {
      handlersRef.current.haptics.peek();
      quickViewRef.current?.open(asset);
    }
    return {
      onPress: (asset) => handlersRef.current.onPress(asset),
      onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
      onLongPress: (asset) => !handlersRef.current.isSelectMode && peek(asset),
      peek,
      endPeek: () => quickViewRef.current?.close(),
    };
  });
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
        onPress={hasPress ? stable.onPress : undefined}
        onDoublePress={asset.deletedAt ? undefined : stable.onDoublePress}
        onLongPress={canPeek ? stable.onLongPress : undefined}
        onLongPressOut={stable.endPeek}
      />
    ),
    [selection, hasPress, canPeek, stable],
  );

  return {
    renderCell,
    quickViewModal: <AssetQuickViewModal ref={quickViewRef} />,
    peek: stable.peek,
    endPeek: stable.endPeek,
  };
}
