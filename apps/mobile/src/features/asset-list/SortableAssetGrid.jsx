import SortableGrid from '@/components/sortable-grid/SortableGrid';

// The album Assets tab's grid: a SortableGrid of square cells, so photos can be dragged into a new
// order, with the props of the virtualized AssetList (library / all-assets view).
export default function SortableAssetGrid({
  rows,
  rowsReadAt,
  loadMore,
  renderListItem,
  paddingTop,
  paddingBottom,
  listRef,
  selectedAssetIds,
  selectAssets,
  dragSelectEnabled,
  reorderEnabled,
  onReorder,
}) {
  return (
    <SortableGrid
      rows={rows}
      rowsReadAt={rowsReadAt}
      loadMore={loadMore}
      renderItem={renderListItem}
      numColumns={3}
      cellPadding={1}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      listRef={listRef}
      dragSelectEnabled={dragSelectEnabled}
      selectedIds={selectedAssetIds}
      onSelect={selectAssets}
      reorderEnabled={reorderEnabled}
      onReorder={onReorder}
      moveFailedTitle="Couldn't move the photo"
    />
  );
}
