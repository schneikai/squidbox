import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';
import type { AssetSelection } from './actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import createSelectionStore from './createSelectionStore';

import quickViewStore from '@/components/quick-view/quickViewStore';
import useHaptics from '@/hooks/useHaptics';
import useSheetRoute from '@/hooks/useSheetRoute';
import useAssets from '@/providers/assets/useAssets';
import type { AssetRow } from '@/sync/db/schema';

export type UseAssetCellsOptions = Partial<Pick<AssetSelection, 'isSelectMode' | 'isAssetSelected'>> & {
  onPress?: (asset: AssetRow) => void;
  canPeek?: boolean;
};

/**
 * Everything an asset grid needs for its cells: `renderCell` (its `renderListItem`), and `peek(asset)`
 * and `endPeek()` for a grid whose long press drags and so peeks itself. Cells favorite on double tap
 * (not deleted assets) and peek on long press (not in select mode, or with `canPeek` off). A peek
 * shows in the QuickViewHost of the surface the grid is in (the sheet's, or the app's) and closes on
 * the release, or when the grid goes away. The handlers reach the cells through a ref, so they keep
 * their identity across renders and the memoized cells skip re-rendering unless their own asset,
 * selection or display props change.
 */
export default function useAssetCells({
  onPress,
  isSelectMode = false,
  isAssetSelected,
  canPeek = true,
}: UseAssetCellsOptions) {
  const { toggleFavoriteAsset } = useAssets();
  const haptics = useHaptics();
  const routeKey = useSheetRoute()?.routeKey ?? null;

  const handlers = { onPress, onDoublePress: toggleFavoriteAsset, isSelectMode, haptics, routeKey };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  // This grid's mark on the peeks it opens, so only it closes them.
  const [peekOwner] = useState(() => ({}));
  const [stable] = useState(() => {
    function peek(asset: AssetRow) {
      handlersRef.current.haptics.peek();
      quickViewStore.open(asset, { routeKey: handlersRef.current.routeKey, owner: peekOwner });
    }
    return {
      // Only passed to the cells while there is an `onPress` (hasPress).
      onPress: (asset: AssetRow) => handlersRef.current.onPress?.(asset),
      onDoublePress: (asset: AssetRow) => handlersRef.current.onDoublePress(asset),
      onLongPress: (asset: AssetRow) => !handlersRef.current.isSelectMode && peek(asset),
      peek,
      endPeek: () => quickViewStore.close(peekOwner),
    };
  });
  const hasPress = !!onPress;

  // The store outlives the grid: a grid that goes away mid-hold (a library switch, a navigation)
  // closes its peek.
  useEffect(() => () => quickViewStore.close(peekOwner), [peekOwner]);

  // Select mode reaches the cells through the store, so renderCell keeps its identity and a toggle
  // re-renders only the selection overlays. Before paint, so the rings show in the same frame.
  const [selection] = useState(createSelectionStore);
  useLayoutEffect(() => selection.set({ isSelectMode, isAssetSelected }), [selection, isSelectMode, isAssetSelected]);

  const renderCell = useCallback(
    (asset: AssetRow) => (
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
