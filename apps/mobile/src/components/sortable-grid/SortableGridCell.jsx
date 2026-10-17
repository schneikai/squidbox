import { memo, useEffect } from 'react';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import gridSlotOrigin from './gridSlotOrigin';

import { motion } from '@/styles/designTokens';

// One absolutely-positioned resting cell in the sortable grid, at its slot in the shared `positions`
// map. Hidden while the lifted copy of it (SortableGridLiftedCell) shows. Memoized: every mounted
// cell would otherwise re-render with the screen. `initialSlot` only places a new cell, so a changed
// slot alone doesn't re-render it.
export default memo(SortableGridCell, (prev, next) =>
  Object.keys(next).every((key) => key === 'initialSlot' || prev[key] === next[key]),
);

function SortableGridCell({ row, renderItem, initialSlot, layout, cellPadding, positions, activeId, shownLiftedId }) {
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
