import { useCallback, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';

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
  handlersRef.current = { onPress, onDoublePress: toggleFavoriteAsset };
  const [stable] = useState(() => ({
    onPress: (asset) => handlersRef.current.onPress(asset),
    onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
    onLongPress: (asset) => quickViewRef.current?.open(asset),
    onLongPressOut: () => quickViewRef.current?.close(),
  }));
  const hasPress = !!onPress;

  const renderCell = useCallback(
    (asset) => (
      <AssetGridCell
        asset={asset}
        isSelectMode={isSelectMode}
        isSelected={isAssetSelected ? isAssetSelected(asset.id) : false}
        showLastPostedAt={showLastPostedAt}
        onPress={hasPress ? stable.onPress : undefined}
        onDoublePress={asset.deletedAt ? undefined : stable.onDoublePress}
        onLongPress={canPeek && !isSelectMode ? stable.onLongPress : undefined}
        onLongPressOut={stable.onLongPressOut}
      />
    ),
    [isSelectMode, isAssetSelected, showLastPostedAt, hasPress, canPeek, stable],
  );

  return { renderCell, quickViewModal: <AssetQuickViewModal ref={quickViewRef} /> };
}
