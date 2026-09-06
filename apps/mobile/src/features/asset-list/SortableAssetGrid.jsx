import { useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import SortableAssetGridCell from './SortableAssetGridCell';
import useAssetDragReorder from './useAssetDragReorder';
import useAssetDragSelect from './useAssetDragSelect';

import useAssets from '@/features/assets-context/useAssets';

// Non-virtualized asset grid used by the album Assets tab. Unlike the virtualized
// AssetList (library / all-assets view), every cell is absolutely positioned so
// it can be dragged and reflowed for Apple Photos-style reordering. Intended for
// album-sized collections only.
export default function SortableAssetGrid({
  assetIds,
  renderListItem,
  contentContainerStyle,
  listRef,
  selectedAssetIds,
  selectAssets,
  dragSelectEnabled = false,
  reorderEnabled = false,
  onReorder,
}) {
  const { assets } = useAssets();
  const numColumns = 3;
  const window = useWindowDimensions();
  const itemSize = window.width / numColumns;
  const paddingTop = contentContainerStyle?.paddingTop ?? 0;

  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue({});
  const activeId = useSharedValue(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);

  useEffect(() => {
    const map = {};
    (assetIds ?? []).forEach((id, i) => {
      map[id] = i;
    });
    positions.value = map;
  }, [assetIds]);

  // Expose a FlatList-compatible ref so useAssetList / the gesture hooks can call
  // scrollToOffset even though we render a ScrollView underneath.
  useEffect(() => {
    if (!listRef) return;
    listRef.current = {
      scrollToOffset: ({ offset, animated }) => scrollRef.current?.scrollTo({ y: offset, animated }),
    };
  });

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

  const dragSelect = useAssetDragSelect({
    enabled: dragSelectEnabled,
    assetIds: assetIds ?? [],
    numColumns,
    itemSize,
    paddingTop,
    listRef,
    scrollY,
    selectedIdsRef,
    selectAssets,
  });

  const dragReorder = useAssetDragReorder({
    enabled: reorderEnabled,
    assetIds: assetIds ?? [],
    numColumns,
    itemSize,
    paddingTop,
    listRef,
    scrollY,
    positions,
    activeId,
    activeX,
    activeY,
    activeScale,
    onReorder,
  });

  if (!assetIds) return null;

  const gesture = Gesture.Exclusive(dragSelect.gesture, dragReorder.gesture);
  const rows = Math.ceil(assetIds.length / numColumns);
  const gridHeight = rows * itemSize;

  function onLayout(e) {
    const { height } = e.nativeEvent.layout;
    dragSelect.onContainerLayout(height);
    dragReorder.onContainerLayout(height);
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={contentContainerStyle}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View style={{ height: gridHeight }}>
            {assetIds.map((assetId, index) => {
              const asset = assets[assetId];
              if (!asset) return null;
              return (
                <SortableAssetGridCell
                  key={assetId}
                  id={assetId}
                  initialSlot={index}
                  itemSize={itemSize}
                  numColumns={numColumns}
                  positions={positions}
                  activeId={activeId}
                  activeX={activeX}
                  activeY={activeY}
                  activeScale={activeScale}
                >
                  {renderListItem(asset)}
                </SortableAssetGridCell>
              );
            })}
          </View>
        </Animated.ScrollView>
      </View>
    </GestureDetector>
  );
}
