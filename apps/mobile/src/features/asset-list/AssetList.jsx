import { useCallback, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import useAssetDragSelect from './useAssetDragSelect';

import useAssets from '@/features/assets-context/useAssets';

// Constant props, so FlatList's own memo isn't defeated on every render of the screen.
const keyExtractor = (assetId) => assetId;
const STICKY_HEADER = [0];

export default function AssetList({
  assetIds,
  ListHeaderComponent,
  renderListItem,
  listRef,
  paddingTop = 0,
  paddingBottom = 0,
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
    paddingTop,
    listRef,
    scrollY: effectiveScrollY,
    selectedIdsRef,
    selectAssets,
  });

  const renderItem = useCallback(
    ({ item: assetId }) => {
      const asset = assets[assetId];
      if (!asset) return null;
      return <View style={{ width: listItemWidth, height: listItemWidth, padding: 1 }}>{renderListItem(asset)}</View>;
    },
    [assets, listItemWidth, renderListItem],
  );

  const contentContainerStyle = useMemo(() => ({ paddingTop, paddingBottom }), [paddingTop, paddingBottom]);

  if (!assetIds) return null;

  const list = (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={assetIds}
      numColumns={numColumns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? STICKY_HEADER : undefined}
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
