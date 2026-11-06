import { useEffect, useState } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  type EntryAnimationsValues,
  type EntryExitAnimationFunction,
  type ExitAnimationsValues,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { PostListItemProps } from './PostListItem';
import stackEdge from './stackEdge';
import usePost from './usePost';

import ThreadConnector from '@/components/ThreadConnector';
import ThreadParts from '@/components/ThreadParts';
import ThreadPost from '@/features/posts/ThreadPost';
import { motion } from '@/styles/designTokens';

// Reanimated runs custom entering and exiting animations only on native: in the web preview the cards
// don't come out of the stack, they show at their place (their content and lines still fade, and the
// list still moves the posts below).
const hasCustomAnimations = Platform.OS !== 'web';
const lineIn = FadeIn.duration(motion.move.duration).easing(motion.move.easing);
const lineOut = FadeOut.duration(motion.exit.duration).easing(motion.exit.easing);
// The cards' photos and text fill in over the second half of the unfold, once the card has grown
// from the blank edge, and fade out over the first half of the fold, gone before it's an edge again.
const contentOut = FadeOut.duration(motion.fill.duration).easing(motion.exit.easing);

type ThreadFollowingPostsProps = {
  postId: string;
  edgeCount: number;
  isUnfoldAnimated: boolean;
  unfoldedPosts: PostListItemProps['unfoldedPosts'];
  roomStyle: StyleProp<ViewStyle>;
};

/**
 * The following posts of a thread unfolded in the posts list, each as a row card (ThreadPost, like
 * the post screen's; a tap on it opens the thread like the rest of the item), joined by the thread's
 * line, in the room under the first card. Read live once mounted (`unfoldedPosts` keeps the last read
 * per thread, so a remount shows them at once); until read they keep the stack's room (`roomStyle`). Once read they come out of the stack: each starts as the stack edge
 * it replaces (the second post the front edge, the third the back one, any further one behind the
 * last edge) and moves and widens to its place in `motion.move`, in step with the posts below
 * (PostList's `itemLayoutAnimation`), unless `isUnfoldAnimated` is false (a cell that comes back on
 * screen already unfolded), and only the posts there when it unfolded (one a sync adds later just
 * shows); their photos and text fade in over the unfold's second half. Unmounted,
 * the cards go back into the stack the same way, their photos and text fading out over the first
 * half.
 */
export default function ThreadFollowingPosts({
  postId,
  edgeCount,
  isUnfoldAnimated,
  unfoldedPosts,
  roomStyle,
}: ThreadFollowingPostsProps) {
  const livePost = usePost(postId);
  const [unfoldPartIds, setUnfoldPartIds] = useState<Set<string> | null>(null);
  const contentOpacity = useSharedValue(isUnfoldAnimated ? 0 : 1);

  const post = livePost ?? unfoldedPosts.get(postId);
  const isRead = Boolean(post);
  // The posts that come out of the stack: those of the first read.
  if (post && !unfoldPartIds) setUnfoldPartIds(new Set(post.threadPosts.map((part) => part.id)));

  useEffect(() => {
    if (livePost) unfoldedPosts.set(postId, livePost);
  }, [livePost, postId, unfoldedPosts]);

  // Starts once the posts are read, as their cards come out of the stack.
  useEffect(() => {
    if (!isRead || !isUnfoldAnimated) return;
    contentOpacity.value = withDelay(motion.fill.duration, withTiming(1, motion.fill));
  }, [isRead, isUnfoldAnimated, contentOpacity]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  if (!post) return <View style={roomStyle} />;

  const count = post.threadPosts.length;

  return (
    <ThreadParts
      parts={post.threadPosts}
      renderConnector={(part) => (
        <Animated.View
          entering={isUnfoldAnimated && unfoldPartIds?.has(part.id) ? lineIn : undefined}
          exiting={lineOut}
        >
          <ThreadConnector />
        </Animated.View>
      )}
      renderPart={(part, index) => (
        <ThreadPost
          post={part}
          entering={
            isUnfoldAnimated && hasCustomAnimations && unfoldPartIds?.has(part.id)
              ? stackMove(index, edgeCount, true)
              : undefined
          }
          exiting={hasCustomAnimations ? stackMove(index, edgeCount, false) : undefined}
          // The front one over the ones behind it, as the edges they come from.
          style={{ zIndex: count - index }}
          contentStyle={contentStyle}
          contentExiting={hasCustomAnimations ? contentOut : undefined}
        />
      )}
    />
  );
}

// Following post `index` (of `edgeCount` edges) out of its stack edge to its place (`isOut`), or
// from its place back into the edge. Entering, Reanimated passes the target values; exiting, the
// current ones.
function stackMove(index: number, edgeCount: number, isOut: boolean): EntryExitAnimationFunction {
  return (values: EntryAnimationsValues | ExitAnimationsValues) => {
    'worklet';
    const edge = stackEdge(index, edgeCount);
    const place =
      'targetOriginX' in values
        ? {
            originX: values.targetOriginX,
            originY: values.targetOriginY,
            width: values.targetWidth,
            height: values.targetHeight,
          }
        : {
            originX: values.currentOriginX,
            originY: values.currentOriginY,
            width: values.currentWidth,
            height: values.currentHeight,
          };
    const inStack = {
      originX: place.originX + edge.inset,
      originY: edge.top,
      width: place.width - 2 * edge.inset,
      height: edge.height,
    };
    const from = isOut ? inStack : place;
    const to = isOut ? place : inStack;
    return {
      initialValues: from,
      animations: {
        originX: withTiming(to.originX, motion.move),
        originY: withTiming(to.originY, motion.move),
        width: withTiming(to.width, motion.move),
        height: withTiming(to.height, motion.move),
      },
    };
  };
}
