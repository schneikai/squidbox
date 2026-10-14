import { useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { SCREEN_PADDING } from '@/constants';

const keyExtractor = (album) => album.id;

// The two-column album grid; `albums` are albumQuery rows (with their cover and stats).
export default function AlbumList({
  albums,
  renderItem,
  ListHeaderComponent,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  // I use window width and num of columns to calculate the width of each album
  // in the view. We also use columnWrapperStyle to get even margins left, right
  // and between the items without having the margins doubled where they touch.

  // Keep side insets and the gap between columns equal to SCREEN_PADDING so the
  // albums grid lines up with the posts list (which pads each item by SCREEN_PADDING).
  const window = useWindowDimensions();
  const numColumns = 2;
  const elementWidth = window.width / numColumns - SCREEN_PADDING * 1.5;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      ref={listRef}
      data={albums}
      numColumns={numColumns}
      columnWrapperStyle={{
        marginHorizontal: SCREEN_PADDING,
        marginTop: SCREEN_PADDING,
        justifyContent: 'space-between',
      }}
      renderItem={({ item: album }) => renderItem({ album, elementWidth })}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
