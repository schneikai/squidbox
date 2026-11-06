import { type RefObject, useCallback, useState } from 'react';
import type { ListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, { type ScrollHandlerProcessed } from 'react-native-reanimated';

import PostListItem, { type PostListItemProps } from './PostListItem';
import type { PostListRow } from './postQuery';
import type { PostDetailRow } from './readPost';

import type { ScrollableList } from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import { reflow } from '@/styles/designTokens';
import toggleItem from '@/utils/toggleItem';

const keyExtractor = (post: PostListRow) => post.id;

type PostListProps = {
  rows: PostListRow[] | undefined;
  loadMore: () => void;
  renderPostActions?: PostListItemProps['renderPostActions'];
  listRef?: RefObject<ScrollableList | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: ScrollHandlerProcessed;
};

/**
 * The posts list: `rows` are the loaded posts of a paged query (each with its `postAssets`),
 * `loadMore` reads the next page when the end comes near. A tap on a post opens it;
 * `renderPostActions(post)` (shown in the post's card, under it) is optional. A thread's mark (or
 * the item's accessibility action) unfolds it in place; which are unfolded is kept per list, for as
 * long as the list is mounted. Every change of a post's place glides (`reflow`): the posts below a
 * thread that unfolds or folds, and as well any post added, removed or resized (a sync, a page of the
 * Ignored sheet), on purpose.
 */
export default function PostList({
  rows,
  loadMore,
  renderPostActions,
  listRef,
  contentContainerStyle,
  onScroll,
}: PostListProps) {
  const [expandedThreadIds, setExpandedThreadIds] = useState<string[]>([]);

  // More is asked for only once the first page landed: a load-more asked before would read a second
  // page at once.
  const onEndReached = rows ? loadMore : undefined;

  // The following posts of the unfolded threads as last read, so a cell that scrolls back on screen
  // unfolded shows them at once at its full height; a toggle drops the thread's (a new unfold reads).
  const [unfoldedPosts] = useState((): Map<string, PostDetailRow> => new Map());

  const attachList = useListRefCallback(listRef);

  const toggleThread = useCallback(
    (postId: string) => {
      unfoldedPosts.delete(postId);
      setExpandedThreadIds((ids) => toggleItem(ids, postId));
    },
    [unfoldedPosts],
  );

  // PostListItem is memoized and gets only stable props (`renderPostActions` too, when the caller keeps
  // it stable). Unfolding a thread re-runs this for the visible cells, but only that one re-renders.
  const renderItem = useCallback(
    ({ item: post }: ListRenderItemInfo<PostListRow>) => (
      <PostListItem
        post={post}
        renderPostActions={renderPostActions}
        isExpanded={expandedThreadIds.includes(post.id)}
        onToggleThread={toggleThread}
        unfoldedPosts={unfoldedPosts}
      />
    ),
    [renderPostActions, expandedThreadIds, toggleThread, unfoldedPosts],
  );

  if (!rows) return null;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={rows}
      renderItem={renderItem}
      itemLayoutAnimation={reflow}
      keyExtractor={keyExtractor}
      contentContainerStyle={contentContainerStyle}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      ref={attachList}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
