// Maps a touch point (in gesture-container space) to a flat grid index, taking the current scroll
// offset and the list's top padding into account; a point in a gap counts for the nearer cell.
// Shared by drag-select and drag-reorder so both agree on which cell the finger is over. `layout`:
// see gridSlotOrigin.
export default function gridIndexAtPoint({ x, y, scrollOffset, paddingTop, layout, count }) {
  const { numColumns, cellWidth, cellHeight, gap } = layout;
  const col = Math.min(Math.max(Math.floor((x - gap / 2) / (cellWidth + gap)), 0), numColumns - 1);
  const contentY = y + scrollOffset - paddingTop;
  if (contentY < 0) return -1;
  const row = Math.floor((contentY + gap / 2) / (cellHeight + gap));
  const index = row * numColumns + col;
  if (index < 0 || index >= count) return -1;
  return index;
}
