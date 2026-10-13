import { useCallback, useRef, useState } from 'react';

import AssetGridCell from './AssetGridCell';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import useAssets from '@/features/assets-context/useAssets';

/**
 * Everything an asset grid needs for its cells: `renderCell` (its `renderListItem`) and the
 * `quickViewModal` to render next to it. Cells favorite on double tap and peek on long press unless
 * turned off. The handlers reach the cells through a ref, so they keep their identity across renders
 * and the memoized cells skip re-rendering unless their own asset, selection or display props change.
 */
export default function useAssetCells({
  onPress,
  isSelectMode = false,
  isAssetSelected,
  showLastPostedAt = false,
  canFavorite = true,
  canPeek = true,
}) {
  const { toggleFavoriteAsset } = useAssets();
  const { asset: peekedAsset, open: peek, close: closePeek } = useAssetQuickViewModal();

  const handlersRef = useRef();
  handlersRef.current = { onPress, onDoublePress: toggleFavoriteAsset, onLongPress: peek, onLongPressOut: closePeek };
  const [stable] = useState(() => ({
    onPress: (asset) => handlersRef.current.onPress(asset),
    onDoublePress: (asset) => handlersRef.current.onDoublePress(asset),
    onLongPress: (asset) => handlersRef.current.onLongPress(asset),
    onLongPressOut: (asset) => handlersRef.current.onLongPressOut(asset),
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
        onDoublePress={canFavorite ? stable.onDoublePress : undefined}
        onLongPress={canPeek ? stable.onLongPress : undefined}
        onLongPressOut={stable.onLongPressOut}
      />
    ),
    [isSelectMode, isAssetSelected, showLastPostedAt, hasPress, canFavorite, canPeek, stable],
  );

  return { renderCell, quickViewModal: <AssetQuickViewModal asset={peekedAsset} isVisible={!!peekedAsset} /> };
}
