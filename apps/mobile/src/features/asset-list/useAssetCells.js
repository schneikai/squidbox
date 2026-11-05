import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';
import createSelectionStore from './createSelectionStore';

import quickViewStore from '@/components/quick-view/quickViewStore';
import useAssets from '@/features/assets-context/useAssets';
import useHaptics from '@/hooks/useHaptics';
import useSheetRoute from '@/hooks/useSheetRoute';

/**
 * Everything an asset grid needs for its cells: `renderCell` (its `renderListItem`), and `peek(asset)`
 * and `endPeek()` for a grid whose long press drags and so peeks itself. Cells favorite on double tap
 * (not deleted assets) and peek on long press (not in select mode, or with `canPeek` off). A peek
 * shows in the QuickViewHost of the surface the grid is in (the sheet's, or the app's) and closes on
 * the release, or when the grid goes away. The handlers reach the cells through a ref, so they keep
 * their identity across renders and the memoized cells skip re-rendering unless their own asset,
 * selection or display props change.
 */
export default function useAssetCells({ onPress, isSelectMode = false, isAssetSelected, canPeek = true }) {
  const { toggleFavoriteAsset } = useAssets();
  const haptics = useHaptics();
  const routeKey = useSheetRoute()?.routeKey ?? null;

  const handlersRef = useRef();
  handlersRef.current = { onPress, onDoublePress: toggleFavoriteAsset, isSelectMode, haptics, routeKey };
  const [stable] = useState(() => {
    function peek(asset) {
      handlersRef.current.haptics.peek();
      // The ref is this grid's own, so it marks the peek as this grid's.
      quickViewStore.open(asset, { routeKey: handlersRef.current.routeKey, owner: handlersRef });
    }
    return {
      onPress: (asset) => handlersRef.current.onPress(asset),
      onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
      onLongPress: (asset) => !handlersRef.current.isSelectMode && peek(asset),
      peek,
      endPeek: () => quickViewStore.close(handlersRef),
    };
  });
  const hasPress = !!onPress;

  // The store outlives the grid: a grid that goes away mid-hold (a library switch, a navigation)
  // closes its peek.
  useEffect(() => () => quickViewStore.close(handlersRef), []);

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
    peek: stable.peek,
    endPeek: stable.endPeek,
  };
}
