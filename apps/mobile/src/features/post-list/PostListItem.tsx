import { router } from 'expo-router';
import { memo, type ReactNode, useState } from 'react';
import { type AccessibilityActionEvent, StyleSheet, View } from 'react-native';

import ThreadFollowingPosts from './ThreadFollowingPosts';
import stackEdge from './stackEdge';

import Button from '@/components/Button';
import Card from '@/components/Card';
import FadeView from '@/components/FadeView';
import SuperPressable from '@/components/SuperPressable';
import postChannelIds from '@/features/channels/postChannelIds';
import MoreAction from '@/features/post-detail/actions/MoreAction';
import PostView from '@/features/posts/PostView';
import longPressAccessibility from '@/lib/longPressAccessibility';
import { layout, space } from '@/styles/designTokens';
import type { PostListRow } from '@/sync/queries/postQuery';
import type { PostDetailRow } from '@/sync/queries/readPost';

// One stack edge per following post, at most this many.
const MAX_EDGES = 2;

export type PostListItemProps = {
  post: PostListRow;
  renderPostActions?: (post: PostListRow) => ReactNode;
  isExpanded: boolean;
  onToggleThread: (postId: string) => void;
  unfoldedPosts: Map<string, PostDetailRow>;
  hasMenu: boolean;
  channelOrder: string[];
};

/**
 * A post in the posts list, as a card (PostView) that opens the post, with `renderPostActions(post)`
 * (buttons for this post, e.g. the Ignored sheet's Restore) in it; with `hasMenu` a long press opens
 * the post's menu (MoreAction, as its ⋯ on the post screen). A thread (a post with following posts) sits on
 * one or two card edges peeking out below (one per following post), a stack, and shows "Thread · N" in its Posted row: a tap on it
 * (or the item's accessibility action) calls `onToggleThread(post.id)`, and while `isExpanded` the
 * thread is unfolded in place: the following posts come out of the stack (ThreadFollowingPosts) as
 * row cards (ThreadPost, as on the post screen), joined by the thread's line; a tap on them
 * opens the post like the rest of the item, and the actions stay in the first card. `post` is a
 * postQuery row: it carries its `postAssets` and `threadCount`; the following posts are read only
 * while unfolded, and kept in `unfoldedPosts` (the list's) so the cell comes back on screen with them.
 * The card's labels show its channels (postChannelIds) in `channelOrder`, the user's channel order.
 */
function PostListItem({
  post,
  renderPostActions,
  isExpanded,
  onToggleThread,
  unfoldedPosts,
  hasMenu,
  channelOrder,
}: PostListItemProps) {
  // A cell that comes back on screen unfolded shows its following posts at once; once folded, the
  // next unfold animates.
  const [isUnfoldAnimated, setIsUnfoldAnimated] = useState(!isExpanded);
  if (!isExpanded && !isUnfoldAnimated) setIsUnfoldAnimated(true);

  const isThread = post.threadCount > 0;
  const edgeCount = Math.min(post.threadCount, MAX_EDGES);
  const room = roomStyles[edgeCount];
  const actions = renderPostActions?.(post);
  const threadActions = isThread
    ? [{ name: 'toggleThread', label: isExpanded ? 'Collapse thread' : 'Expand thread' }]
    : undefined;

  function openPost() {
    router.navigate(`/post/${post.id}`);
  }

  function toggleThread() {
    onToggleThread(post.id);
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === 'toggleThread') toggleThread();
  }

  const card = (openFromLongPress?: () => void) => (
    <SuperPressable
      onPress={openPost}
      onLongPress={openFromLongPress}
      style={styles.post}
      {...longPressAccessibility(openFromLongPress, {
        label: 'Post options',
        actions: threadActions,
        onOtherAction: handleAccessibilityAction,
      })}
    >
      <View style={styles.firstCard} collapsable={false}>
        <PostView
          post={post}
          channelIds={postChannelIds(post, channelOrder)}
          meta={
            isThread && (
              <Button
                label={`Thread · ${1 + post.threadCount}`}
                size="caption"
                colorPalette="muted"
                onPress={toggleThread}
                style={styles.threadMark}
              />
            )
          }
        >
          {actions}
        </PostView>
      </View>
      {isThread && (
        // Kept as a view (not flattened into the item): the following posts' animations are relative to it.
        <View collapsable={false}>
          <FadeView isVisible={!isExpanded} style={[styles.edges, room]} pointerEvents="none">
            {/* The back one first, so the front one covers it. */}
            {Array.from({ length: edgeCount }, (_, i) => {
              const index = edgeCount - 1 - i;
              return <Card key={index} style={[styles.edge, edgeFrame(index, edgeCount)]} />;
            })}
          </FadeView>
          {isExpanded ? (
            <ThreadFollowingPosts
              postId={post.id}
              edgeCount={edgeCount}
              isUnfoldAnimated={isUnfoldAnimated}
              unfoldedPosts={unfoldedPosts}
              roomStyle={room}
            />
          ) : (
            <View style={room} />
          )}
        </View>
      )}
    </SuperPressable>
  );

  return hasMenu ? <MoreAction post={post} trigger={({ openFromLongPress }) => card(openFromLongPress)} /> : card();
}

export default memo(PostListItem);

// Where edge `index` of a stack of `edgeCount` is drawn (stackEdge).
function edgeFrame(index: number, edgeCount: number) {
  const { top, height, inset } = stackEdge(index, edgeCount);
  return { top, height, left: inset, right: inset };
}

// The room under the first card that a stack of 1 or 2 edges takes: down to its last edge's bottom.
const roomStyles = StyleSheet.create(
  Object.fromEntries(
    [1, 2].map((edgeCount) => {
      const { top, height } = stackEdge(edgeCount - 1, edgeCount);
      return [edgeCount, { height: top + height }];
    }),
  ),
);

const styles = StyleSheet.create({
  // Nothing above a post, so the list's top padding alone sets where the first one starts; the room
  // between posts is all below each.
  post: {
    flex: 1,
    paddingHorizontal: layout.sideGutter,
    paddingBottom: space.lg,
  },
  // A thread's: over the stack under it, the edges and the following posts while they come out of it.
  firstCard: {
    zIndex: 1,
  },
  // Over the room under the first card where the folded stack's edges show (stackEdge).
  edges: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // A card edge the thread's card sits on: the bottom of a card behind it, each further in.
  edge: {
    position: 'absolute',
  },
  // Right-aligned in the Posted row.
  threadMark: {
    marginLeft: 'auto',
  },
});
