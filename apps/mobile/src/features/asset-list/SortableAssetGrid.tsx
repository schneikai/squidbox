import type { AssetListProps } from './AssetList';

import SortableGrid, { type SortableGridProps } from '@/components/sortable-grid/SortableGrid';
import { layout } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';

export type SortableAssetGridProps = AssetListProps & {
  rowsReadAt?: number;
  reorderEnabled?: boolean;
  onReorder?: SortableGridProps<AssetRow>['onReorder'];
};

// The album Assets tab's grid: a SortableGrid of square cells, so photos can be dragged into a new
// order, with the props of the virtualized AssetList (library / all-assets view). It tracks its own
// scroll offset, so `onScroll` alone keeps a caller's `scrollY` current.
export default function SortableAssetGrid({
  rows,
  rowsReadAt,
  loadMore,
  renderListItem,
  paddingTop,
  paddingBottom,
  header,
  listRef,
  onScroll,
  selectedAssetIds,
  selectAssets,
  dragSelectEnabled,
  dragSelectLocksSwipeBack,
  reorderEnabled,
  onReorder,
  onPeek,
  onPeekEnd,
}: SortableAssetGridProps) {
  return (
    <SortableGrid
      rows={rows}
      rowsReadAt={rowsReadAt}
      loadMore={loadMore}
      renderItem={renderListItem}
      numColumns={3}
      cellPadding={layout.gridGutter}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      header={header}
      listRef={listRef}
      onScroll={onScroll}
      dragSelectEnabled={dragSelectEnabled}
      dragSelectLocksSwipeBack={dragSelectLocksSwipeBack}
      selectedIds={selectedAssetIds}
      onSelect={selectAssets}
      reorderEnabled={reorderEnabled}
      onReorder={onReorder}
      onPeek={onPeek}
      onPeekEnd={onPeekEnd}
      moveFailedTitle="Couldn't move the photo"
    />
  );
}
