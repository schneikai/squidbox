import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import FoldView from './FoldView';
import ThreadFollowingPosts from './ThreadFollowingPosts';

import Button from '@/components/Button';
import Card from '@/components/Card';
import FadeView from '@/components/FadeView';
import SuperPressable from '@/components/SuperPressable';
import PostView from '@/features/posts/PostView';
import { layout, motion, scale } from '@/styles/designTokens';

// How far a thread's stacked edges show below its card, and how far in each sits.
const STACK_STEP = scale(7);
const STACK_INSET = scale(12);

/**
 * A post in the posts list, as a card (PostView) that opens the post, with `renderPostActions(post)`
 * (buttons for this post, e.g. the Ignored sheet's Restore) in it. A thread (a post with following posts) sits on
 * two card edges peeking out below, a stack, and shows "Thread · N" in its Posted row: a tap on it
 * (or the item's accessibility action) calls `onToggleThread(post.id)`, and while `isExpanded` the
 * thread is unfolded in place: the edges fade away and the following posts come out under the first
 * one as row cards (ThreadPost, as on the post screen), joined by the thread's line; a tap on them
 * opens the post like the rest of the item, and the actions stay in the first card. `post` is a
 * postQuery row: it carries its `postAssets` and `threadCount`; the following posts are read only
 * while unfolded.
 */
function PostListItem({ post, renderPostActions, isExpanded, onToggleThread }) {
  const isThread = post.threadCount > 0;
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

  return (
    <SuperPressable
      onPress={openPost}
      style={styles.post}
      accessibilityActions={threadActions}
      onAccessibilityAction={isThread ? toggleThread : undefined}
    >
      {isThread ? (
        <>
          <ThreadStack isExpanded={isExpanded}>
            <PostView
              post={post}
              meta={
                <Button
                  label={`Thread · ${1 + post.threadCount}`}
                  size="caption"
                  colorPalette="muted"
                  onPress={toggleThread}
                  style={styles.threadMark}
                />
              }
            >
              {actions}
            </PostView>
          </ThreadStack>
          <FoldView isOpen={isExpanded}>
            <ThreadFollowingPosts postId={post.id} />
          </FoldView>
        </>
      ) : (
        <PostView post={post}>{actions}</PostView>
      )}
    </SuperPressable>
  );
}

export default memo(PostListItem);

// The first card on its two stacked edges, which fade away and give back their room while expanded.
function ThreadStack({ isExpanded, children }) {
  const stackStyle = useAnimatedStyle(() => ({
    paddingBottom: withTiming(isExpanded ? 0 : STACK_STEP * 2, motion.move),
  }));

  return (
    <Animated.View style={stackStyle}>
      <FadeView isVisible={!isExpanded} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Card style={[styles.edge, styles.edgeBack]} />
        <Card style={[styles.edge, styles.edgeFront]} />
      </FadeView>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Nothing above a post, so the list's top padding alone sets where the first one starts; the room
  // between posts is all below each.
  post: {
    flex: 1,
    paddingHorizontal: layout.sideGutter,
    paddingBottom: scale(14),
  },
  // The card edges a thread's card sits on: the bottoms of two cards behind it, each further in.
  edge: {
    position: 'absolute',
    height: scale(40),
  },
  edgeFront: {
    left: STACK_INSET,
    right: STACK_INSET,
    bottom: STACK_STEP,
  },
  edgeBack: {
    left: STACK_INSET * 2,
    right: STACK_INSET * 2,
    bottom: 0,
  },
  // Right-aligned in the Posted row.
  threadMark: {
    marginLeft: 'auto',
  },
});
