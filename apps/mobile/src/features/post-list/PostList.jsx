import { useCallback, useState } from 'react';
import Animated from 'react-native-reanimated';

import PostListItem from './PostListItem';

import { reflow } from '@/styles/designTokens';
import toggleItem from '@/utils/toggleItem';

const FIRST_ENTRY = { id: 'FirstListEntryComponent' };
const keyExtractor = (post) => post.id;

/**
 * The posts list: `rows` are the loaded posts of a paged query (each with its `postAssets`),
 * `loadMore` reads the next page when the end comes near. A tap on a post opens it;
 * `renderPostActions(post)` (shown in the post's card, under it) is optional. A thread's mark (or
 * the item's accessibility action) unfolds it in place; which are unfolded is kept per list, for as
 * long as the list is mounted. Every change of a post's place glides (`reflow`): the posts below a
 * thread that unfolds or folds, and as well any post added, removed or resized (a sync, a page of the
 * Ignored sheet), on purpose.
 *
 * @param {object} props
 * @param {import('./postQuery').PostListRow[] | undefined} props.rows
 * @param {() => void} props.loadMore
 * @param {import('react').ReactElement} [props.ListHeaderComponent]
 * @param {import('react').ComponentType} [props.FirstListEntryComponent]
 * @param {(post: import('./postQuery').PostListRow) => import('react').ReactNode} [props.renderPostActions]
 * @param {import('react').Ref<import('react-native').FlatList>} [props.listRef]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * @param {import('react-native').FlatListProps<unknown>['onScroll']} [props.onScroll]
 */
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

  // The following posts of the unfolded threads as last read, so a cell that scrolls back on screen
  // unfolded shows them at once at its full height; a toggle drops the thread's (a new unfold reads).
  const [unfoldedPosts] = useState(() => new Map());

  const toggleThread = useCallback(
    (postId) => {
      unfoldedPosts.delete(postId);
      setExpandedThreadIds((ids) => toggleItem(ids, postId));
    },
    [unfoldedPosts],
  );

  // PostListItem is memoized and gets only stable props (`renderPostActions` too, when the caller keeps
  // it stable). Unfolding a thread re-runs this for the visible cells, but only that one re-renders.
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
          unfoldedPosts={unfoldedPosts}
        />
      ),
    [FirstListEntryComponent, renderPostActions, expandedThreadIds, toggleThread, unfoldedPosts],
  );

  if (!data) return null;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={data}
      renderItem={renderItem}
      itemLayoutAnimation={reflow}
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
