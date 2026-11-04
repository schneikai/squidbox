import { useState } from 'react';

// The least room between a header's centred title and a side pill.
const SIDE_GAP = 12;

/**
 * The widest a header's title may be (FloatingDetailHeader, ModalHeader): centred on the row and
 * clear of the wider side pill. Pass `onRowLayout`, `onLeftLayout` and `onRightLayout` to the row and
 * its side views; `maxWidth` is undefined until the row was measured.
 */
export default function useTitleMaxWidth() {
  const [widths, setWidths] = useState({ row: 0, left: 0, right: 0 });

  function measure(side) {
    return (e) => {
      const { width } = e.nativeEvent.layout;
      setWidths((current) => (current[side] === width ? current : { ...current, [side]: width }));
    };
  }

  const maxWidth = widths.row
    ? Math.max(0, widths.row - 2 * (Math.max(widths.left, widths.right) + SIDE_GAP))
    : undefined;
  return { maxWidth, onRowLayout: measure('row'), onLeftLayout: measure('left'), onRightLayout: measure('right') };
}
