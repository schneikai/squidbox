/**
 * The content-space top-left of a slot in a grid. `layout`: `numColumns`, `cellWidth`, `cellHeight`
 * and `gap`, between the cells and also left of the first column (but not above the first row, so
 * the list's top padding alone sets where it starts). A worklet, so the cells can place themselves
 * on the UI thread.
 */
export default function gridSlotOrigin(layout, slot) {
  'worklet';
  const { numColumns, cellWidth, cellHeight, gap } = layout;
  return {
    x: gap + (slot % numColumns) * (cellWidth + gap),
    y: Math.floor(slot / numColumns) * (cellHeight + gap),
  };
}
