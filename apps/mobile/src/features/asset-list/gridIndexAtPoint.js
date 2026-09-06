// Maps a touch point (in gesture-container space) to a flat grid index, taking
// the current scroll offset and the list's top padding into account. Shared by
// drag-select and drag-reorder so both agree on which cell the finger is over.
export default function gridIndexAtPoint({ x, y, scrollOffset, paddingTop, itemSize, numColumns, count }) {
  const col = Math.min(Math.max(Math.floor(x / itemSize), 0), numColumns - 1);
  const contentY = y + scrollOffset - paddingTop;
  if (contentY < 0) return -1;
  const row = Math.floor(contentY / itemSize);
  const index = row * numColumns + col;
  if (index < 0 || index >= count) return -1;
  return index;
}
