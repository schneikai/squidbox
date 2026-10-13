import { memo } from 'react';

import AssetListItem from './AssetListItem';

import SuperPressable from '@/components/SuperPressable';

// Memoized with stable handlers (see useAssetCells), so a selection change or a write to one asset
// re-renders only the cells whose props changed, not every cell on screen.
export default memo(AssetGridCell);

function AssetGridCell({
  asset,
  isSelectMode,
  isSelected,
  showLastPostedAt,
  onPress,
  onDoublePress,
  onLongPress,
  onLongPressOut,
}) {
  return (
    <SuperPressable
      onPress={onPress && (() => onPress(asset))}
      onDoublePress={onDoublePress && (() => onDoublePress(asset))}
      onLongPress={onLongPress && (() => onLongPress(asset))}
      onLongPressOut={onLongPressOut && (() => onLongPressOut(asset))}
      style={{ flex: 1 }}
      // Not focusable by a click (web): opening the peek moves focus into its modal, and losing focus
      // would end the long press at once, closing the peek. No effect on native.
      tabIndex={null}
    >
      <AssetListItem
        asset={asset}
        isSelectMode={isSelectMode}
        isSelected={isSelected}
        showLastPostedAt={showLastPostedAt}
      />
    </SuperPressable>
  );
}
