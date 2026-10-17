/**
 * The content-space top-left of a slot in a grid. `layout`: `numColumns`, `cellWidth`, `cellHeight`
 * and `gap`, which is also left of the first column and above the first row. A worklet, so the cells
 * can place themselves on the UI thread.
 */
export default function gridSlotOrigin(layout, slot) {
  'worklet';
  const { numColumns, cellWidth, cellHeight, gap } = layout;
  return {
    x: gap + (slot % numColumns) * (cellWidth + gap),
    y: gap + Math.floor(slot / numColumns) * (cellHeight + gap),
  };
}
