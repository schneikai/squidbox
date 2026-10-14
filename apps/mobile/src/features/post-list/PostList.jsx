import Animated from 'react-native-reanimated';

const FIRST_ENTRY = { id: 'FirstListEntryComponent' };
const keyExtractor = (post) => post.id;

// The posts list: `rows` are the loaded posts of a paged query (each with its `postAssets`),
// `loadMore` reads the next page when the end comes near.
export default function PostList({
  rows,
  loadMore,
  ListHeaderComponent,
  FirstListEntryComponent,
  renderListItem,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const data = FirstListEntryComponent ? [FIRST_ENTRY, ...(rows ?? [])] : rows;

  if (!data) return null;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={data}
      renderItem={({ item: post }) => (post === FIRST_ENTRY ? FirstListEntryComponent : renderListItem(post))}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onEndReached={loadMore}
      onEndReachedThreshold={2}
      ref={listRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
