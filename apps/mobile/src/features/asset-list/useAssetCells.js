import { useCallback, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';

/**
 * A `renderListItem` for the asset grids. The handlers reach the cells through a ref, so they keep
 * their identity across renders and the memoized cells skip re-rendering unless their own asset,
 * selection or display props change.
 */
export default function useAssetCells({
  isSelectMode = false,
  isAssetSelected,
  showLastPostedAt = false,
  onPress,
  onDoublePress,
  onLongPress,
  onLongPressOut,
}) {
  const handlersRef = useRef();
  handlersRef.current = { onPress, onDoublePress, onLongPress, onLongPressOut };
  const [stable] = useState(() => ({
    onPress: (asset) => handlersRef.current.onPress(asset),
    onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
    onLongPress: (asset) => handlersRef.current.onLongPress(asset),
    onLongPressOut: (asset) => handlersRef.current.onLongPressOut(asset),
  }));
  const hasPress = !!onPress;
  const hasDoublePress = !!onDoublePress;
  const hasLongPress = !!onLongPress;
  const hasLongPressOut = !!onLongPressOut;

  return useCallback(
    (asset) => (
      <AssetGridCell
        asset={asset}
        isSelectMode={isSelectMode}
        isSelected={isAssetSelected ? isAssetSelected(asset.id) : false}
        showLastPostedAt={showLastPostedAt}
        onPress={hasPress ? stable.onPress : undefined}
        onDoublePress={hasDoublePress ? stable.onDoublePress : undefined}
        onLongPress={hasLongPress ? stable.onLongPress : undefined}
        onLongPressOut={hasLongPressOut ? stable.onLongPressOut : undefined}
      />
    ),
    [isSelectMode, isAssetSelected, showLastPostedAt, hasPress, hasDoublePress, hasLongPress, hasLongPressOut, stable],
  );
}
