import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { GridLayout, GridRow } from './gridSlotOrigin';
import type { DragValues } from './useDragReorder';

import { shadows } from '@/styles/designTokens';

export type SortableGridLiftedCellProps<Row extends GridRow> = {
  row: Row;
  renderItem: (row: Row) => ReactNode;
  layout: GridLayout;
  cellPadding: number;
} & Pick<DragValues, 'activeId' | 'activeX' | 'activeY' | 'activeScale' | 'shownLiftedId'>;

// The cell a drag lifted, drawn once above the grid: it follows the finger (`activeX`/`activeY`,
// content space) and pops (`activeScale`), so the resting cells don't read those on every frame. It
// shows once it has laid out (`shownLiftedId`), and its resting cell hides then; until that frame the
// resting cell still shows, so the swap never leaves a gap.
export default function SortableGridLiftedCell<Row extends GridRow>({
  row,
  renderItem,
  layout,
  cellPadding,
  activeId,
  activeX,
  activeY,
  activeScale,
  shownLiftedId,
}: SortableGridLiftedCellProps<Row>) {
  const id = row.id;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: activeX.value }, { translateY: activeY.value }, { scale: activeScale.value }],
    opacity: activeId.value === id && shownLiftedId.value === id ? 1 : 0,
  }));

  function handleLayout() {
    shownLiftedId.value = id;
  }

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={handleLayout}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: layout.cellWidth,
          height: layout.cellHeight,
          padding: cellPadding,
          zIndex: 10,
        },
        shadows.lifted,
        style,
      ]}
    >
      {renderItem(row)}
    </Animated.View>
  );
}
