import { View, StyleSheet, Text } from 'react-native';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import PostView from '@/features/posts/PostView';
import { colors, scale, sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// How far a thread's stacked edges show below its card, and how far in each sits.
const STACK_STEP = scale(7);
const STACK_INSET = scale(12);

/**
 * A post in the posts list, as a card (PostView) with "N posts" for a thread and its heart, and
 * `actions` (buttons for this post, e.g. a Repost suggestion's) under them. A thread (a post with
 * following posts) sits on two card edges peeking out below, a stack; its following posts aren't
 * shown. `post` is a postQuery row: it carries its `postAssets` and `threadCount`.
 */
export default function PostListItem({ post, actions }) {
  const { isFavorite, threadCount } = post;
  const isThread = threadCount > 0;

  return (
    <View style={isThread && styles.stacked}>
      {isThread && (
        <>
          <Card style={[styles.edge, styles.edgeBack]} />
          <Card style={[styles.edge, styles.edgeFront]} />
        </>
      )}
      <PostView
        post={post}
        meta={
          <>
            {isThread && (
              <View style={styles.threadMark}>
                <Icon name="thread" size={sizes.captionIcon} color={colors.accent.base} />
                <Text style={listTextStyles.captionAccent}>{`${1 + threadCount} posts`}</Text>
              </View>
            )}
            {isFavorite && (
              <Icon name="heart" filled size={sizes.captionIcon} color={colors.status.danger} style={styles.heart} />
            )}
          </>
        }
      >
        {actions}
      </PostView>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: {
    paddingBottom: STACK_STEP * 2,
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
  threadMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  heart: {
    marginLeft: 'auto',
  },
});
