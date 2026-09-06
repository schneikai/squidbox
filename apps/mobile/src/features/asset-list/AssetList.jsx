import { useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import useAssetDragSelect from './useAssetDragSelect';

import useAssets from '@/features/assets-context/useAssets';

export default function AssetList({
  assetIds,
  ListHeaderComponent,
  renderListItem,
  listRef,
  contentContainerStyle,
  onScroll,
  scrollY,
  dragSelectEnabled = false,
  selectedAssetIds,
  selectAssets,
}) {
  const { assets } = useAssets();
  const numColumns = 3;
  const window = useWindowDimensions();
  const listItemWidth = window.width / numColumns;

  // Track scroll offset internally when the screen doesn't already provide a
  // handler (e.g. album detail). When one is provided (library floating bars) we
  // reuse its shared value so drag-select reads an always-current offset.
  const internalScrollY = useSharedValue(0);
  const internalScrollHandler = useAnimatedScrollHandler((event) => {
    internalScrollY.value = event.contentOffset.y;
  });
  const effectiveScrollY = scrollY ?? internalScrollY;
  const effectiveOnScroll = onScroll ?? internalScrollHandler;

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

  const { gesture, onContainerLayout } = useAssetDragSelect({
    enabled: dragSelectEnabled,
    assetIds: assetIds ?? [],
    numColumns,
    itemSize: listItemWidth,
    paddingTop: contentContainerStyle?.paddingTop ?? 0,
    listRef,
    scrollY: effectiveScrollY,
    selectedIdsRef,
    selectAssets,
  });

  if (!assetIds) return null;

  const list = (
    <Animated.FlatList
      data={assetIds}
      numColumns={numColumns}
      renderItem={({ item: assetId }) => {
        const asset = assets[assetId];
        if (!asset) return null;
        return <View style={{ width: listItemWidth, height: listItemWidth, padding: 1 }}>{renderListItem(asset)}</View>;
      }}
      keyExtractor={(assetId) => assetId}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      ref={listRef}
      onScroll={effectiveOnScroll}
      scrollEventThrottle={16}
    />
  );

  // Only wrap in the drag-select gesture when the screen opted in by passing
  // selectAssets. Keeping the wrapper mounted regardless of select mode
  // avoids remounting the list (which would reset scroll position).
  if (!selectAssets) return list;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={(e) => onContainerLayout(e.nativeEvent.layout.height)}>
        {list}
      </View>
    </GestureDetector>
  );
}
