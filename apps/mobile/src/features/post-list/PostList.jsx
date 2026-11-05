import { useCallback, useState } from 'react';
import Animated from 'react-native-reanimated';

import PostListItem from './PostListItem';

import toggleItem from '@/utils/toggleItem';

const FIRST_ENTRY = { id: 'FirstListEntryComponent' };
const keyExtractor = (post) => post.id;

// The posts list: `rows` are the loaded posts of a paged query (each with its `postAssets`),
// `loadMore` reads the next page when the end comes near. A tap on a post opens it;
// `renderPostActions(post)` (shown in the post's card, under it) is optional. A thread's mark (or
// the item's accessibility action) unfolds it in place; which are unfolded is kept per list, for as
// long as the list is mounted.
export default function PostList({
  rows,
  loadMore,
  ListHeaderComponent,
  FirstListEntryComponent,
  renderPostActions,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const [expandedThreadIds, setExpandedThreadIds] = useState([]);

  const data = FirstListEntryComponent ? [FIRST_ENTRY, ...(rows ?? [])] : rows;
  // More is asked for only once the first page landed: until then the list is just the first entry,
  // and a load-more asked then would read a second page at once.
  const onEndReached = rows ? loadMore : undefined;

  const toggleThread = useCallback((postId) => setExpandedThreadIds((ids) => toggleItem(ids, postId)), []);

  // PostListItem is memoized and gets only stable props (`renderPostActions` too, when the caller keeps
  // it stable), so unfolding a thread re-renders that one cell.
  const renderItem = useCallback(
    ({ item: post }) =>
      post === FIRST_ENTRY ? (
        FirstListEntryComponent
      ) : (
        <PostListItem
          post={post}
          renderPostActions={renderPostActions}
          isExpanded={expandedThreadIds.includes(post.id)}
          onToggleThread={toggleThread}
        />
      ),
    [FirstListEntryComponent, renderPostActions, expandedThreadIds, toggleThread],
  );

  if (!data) return null;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      ref={listRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
