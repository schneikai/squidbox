import { View, FlatList, useWindowDimensions } from 'react-native';

import useAssets from '@/features/assets-context/useAssets';

export default function AssetList({
  assetIds,
  ListHeaderComponent,
  renderListItem,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const { assets } = useAssets();
  const numColumns = 3;
  const window = useWindowDimensions();
  const listItemWidth = window.width / numColumns;

  if (!assetIds) return null;

  return (
    <FlatList
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
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
