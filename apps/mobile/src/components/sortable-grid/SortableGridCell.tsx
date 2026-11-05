import { memo, type ReactNode, useEffect } from 'react';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import gridSlotOrigin, { type GridLayout } from './gridSlotOrigin';

import { motion } from '@/styles/designTokens';

// One absolutely-positioned resting cell in the sortable grid, at its slot in the shared `positions`
// map. Hidden while the lifted copy of it (SortableGridLiftedCell) shows. Memoized: every mounted
// cell would otherwise re-render with the screen. `initialSlot` only places a new cell, so a changed
// slot alone doesn't re-render it.
// memo drops the component's type parameter, so the memoized one keeps the component's own type.
export default memo(SortableGridCell, sameCellProps) as typeof SortableGridCell;

export type SortableGridCellProps<Row extends { id: string }> = {
  row: Row;
  renderItem: (row: Row) => ReactNode;
  initialSlot: number;
  layout: GridLayout;
  cellPadding: number;
  positions: SharedValue<Record<string, number>>;
  activeId: SharedValue<string | null>;
  shownLiftedId: SharedValue<string | null>;
};

function sameCellProps<Row extends { id: string }>(prev: SortableGridCellProps<Row>, next: SortableGridCellProps<Row>) {
  let key: keyof SortableGridCellProps<Row>;
  for (key in next) if (key !== 'initialSlot' && prev[key] !== next[key]) return false;
  return true;
}

function SortableGridCell<Row extends { id: string }>({
  row,
  renderItem,
  initialSlot,
  layout,
  cellPadding,
  positions,
  activeId,
  shownLiftedId,
}: SortableGridCellProps<Row>) {
  const id = row.id;
  const origin = gridSlotOrigin(layout, initialSlot);
  const translateX = useSharedValue(origin.x);
  const translateY = useSharedValue(origin.y);

  // A new layout (e.g. a measured cell height) places the cell at once.
  useEffect(() => {
    const { x, y } = gridSlotOrigin(layout, positions.value[id] ?? initialSlot);
    translateX.value = x;
    translateY.value = y;
  }, [layout]);

  // Slots a drag moves spring there; any other new slot (new rows, a sort, a search) jumps.
  useAnimatedReaction(
    () => positions.value[id],
    (slot, prev) => {
      if (slot == null || slot === prev) return;
      const { x, y } = gridSlotOrigin(layout, slot);
      const isDragMove = prev != null && activeId.value !== null;
      translateX.value = isDragMove ? withSpring(x, motion.spring) : x;
      translateY.value = isDragMove ? withSpring(y, motion.spring) : y;
    },
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: activeId.value === id && shownLiftedId.value === id ? 0 : 1,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: layout.cellWidth,
          height: layout.cellHeight,
          padding: cellPadding,
        },
        style,
      ]}
    >
      {renderItem(row)}
    </Animated.View>
  );
}
