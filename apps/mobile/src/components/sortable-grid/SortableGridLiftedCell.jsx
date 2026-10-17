import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// The cell a drag lifted, drawn once above the grid: it follows the finger (`activeX`/`activeY`,
// content space) and pops (`activeScale`), so the resting cells don't read those on every frame. It
// shows once it has laid out (`shownLiftedId`), and its resting cell hides then; until that frame the
// resting cell still shows, so the swap never leaves a gap.
export default function SortableGridLiftedCell({
  row,
  renderItem,
  layout,
  cellPadding,
  activeId,
  activeX,
  activeY,
  activeScale,
  shownLiftedId,
}) {
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
          shadowOpacity: 0.35,
        },
        style,
      ]}
    >
      {renderItem(row)}
    </Animated.View>
  );
}
