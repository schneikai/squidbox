import { memo } from 'react';

import AssetListItem, { type AssetListItemProps } from './AssetListItem';

import SuperPressable from '@/components/SuperPressable';
import type { AssetRow } from '@/sync/db/schema';

// Memoized with stable handlers (see useAssetCells), so a selection change or a write to one asset
// re-renders only the cells whose props changed, not every cell on screen.
export default memo(AssetGridCell);

type AssetGridCellProps = {
  asset: AssetRow;
  selection: AssetListItemProps['selection'];
  onPress?: (asset: AssetRow) => void;
  onDoublePress?: (asset: AssetRow) => void;
  onLongPress?: (asset: AssetRow) => void;
  onLongPressOut?: (asset: AssetRow) => void;
};
function AssetGridCell({ asset, selection, onPress, onDoublePress, onLongPress, onLongPressOut }: AssetGridCellProps) {
  return (
    <SuperPressable
      onPress={onPress && (() => onPress(asset))}
      onDoublePress={onDoublePress && (() => onDoublePress(asset))}
      onLongPress={onLongPress && (() => onLongPress(asset))}
      onLongPressOut={onLongPressOut && (() => onLongPressOut(asset))}
      style={{ flex: 1 }}
      testID="asset-cell"
    >
      <AssetListItem asset={asset} selection={selection} />
    </SuperPressable>
  );
}
