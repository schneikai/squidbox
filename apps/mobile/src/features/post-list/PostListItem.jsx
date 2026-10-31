import { View, StyleSheet, Text } from 'react-native';

import PostImage from './PostImage';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { colors, lineHeights, scale, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import isPresent from '@/utils/isPresent';

// How far a thread's stacked edges show below its card, and how far in each sits.
const STACK_STEP = scale(7);
const STACK_INSET = scale(12);

/**
 * A post in the posts list, as a card: its pictures, its text, then when it was posted, "N posts" for
 * a thread and its heart, and `actions` (buttons for this post, e.g. a Repost suggestion's) under them.
 * A thread (a post with following posts) sits on two card edges peeking out below, a stack; its
 * following posts aren't shown. `post` is a postQuery row: it carries its `postAssets` ([{ id, asset }])
 * and `threadCount`.
 */
export default function PostListItem({ post, actions }) {
  const { text, postAssets, isFavorite, postedAt, threadCount } = post;
  const isThread = threadCount > 0;

  return (
    <View style={isThread && styles.stacked}>
      {isThread && (
        <>
          <Card style={[styles.edge, styles.edgeBack]} />
          <Card style={[styles.edge, styles.edgeFront]} />
        </>
      )}
      <Card style={styles.card}>
        {isPresent(postAssets) && <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} />}
        <View style={styles.body}>
          {isPresent(text) && <Text style={styles.text}>{text}</Text>}
          <View style={styles.meta}>
            <PostPostedAt postedAt={postedAt} />
            {isThread && (
              <View style={styles.threadMark}>
                <Icon name="thread" size={scale(14)} color={colors.accent.base} />
                <Text style={[listTextStyles.caption, styles.threadMarkText]}>{`${1 + threadCount} posts`}</Text>
              </View>
            )}
            {isFavorite && (
              <Icon name="heart" filled size={scale(16)} color={colors.status.danger} style={styles.heart} />
            )}
          </View>
          {actions}
        </View>
      </Card>
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
  card: {
    padding: scale(10),
    gap: scale(12),
  },
  body: {
    paddingHorizontal: scale(6),
    paddingBottom: scale(4),
    gap: scale(10),
  },
  text: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    minHeight: scale(16),
  },
  threadMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  threadMarkText: {
    color: colors.accent.base,
  },
  heart: {
    marginLeft: 'auto',
  },
});
