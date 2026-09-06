import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

// One absolutely-positioned cell in the sortable grid. Rests at its slot via
// springs driven by the shared `positions` map; while it is the lifted cell it
// follows the shared active translate/scale values instead.
export default function SortableAssetGridCell({
  id,
  initialSlot,
  itemSize,
  numColumns,
  positions,
  activeId,
  activeX,
  activeY,
  activeScale,
  children,
}) {
  const translateX = useSharedValue((initialSlot % numColumns) * itemSize);
  const translateY = useSharedValue(Math.floor(initialSlot / numColumns) * itemSize);

  // The reaction body runs as a worklet on the UI thread, so the slot->xy math
  // is inlined here (calling a non-worklet helper from inside would crash).
  useAnimatedReaction(
    () => positions.value[id],
    (slot, prev) => {
      if (slot == null || slot === prev) return;
      const x = (slot % numColumns) * itemSize;
      const y = Math.floor(slot / numColumns) * itemSize;
      translateX.value = withSpring(x, SPRING);
      translateY.value = withSpring(y, SPRING);
    },
  );

  const style = useAnimatedStyle(() => {
    const isActive = activeId.value === id;
    return {
      transform: [
        { translateX: isActive ? activeX.value : translateX.value },
        { translateY: isActive ? activeY.value : translateY.value },
        { scale: isActive ? activeScale.value : 1 },
      ],
      zIndex: isActive ? 10 : 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      shadowOpacity: isActive ? 0.35 : 0,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: itemSize,
          height: itemSize,
          padding: 1,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
