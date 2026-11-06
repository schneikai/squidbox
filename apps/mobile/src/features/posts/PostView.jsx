import { StyleSheet, View } from 'react-native';

import PostImage from './PostImage';

import Card from '@/components/Card';
import Text from '@/components/Text';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { layout, scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

/**
 * A post as a card: its pictures (`onPressAsset(asset)` makes each open), its text (copied on a
 * long press with `isTextSelectable`), then a row with when it was posted and `meta` (what else the
 * place shows about it: a thread's size), and `children` under that row (buttons for this post).
 * `post` is a postQuery row: it carries its `postAssets` ([{ id, asset }]).
 * @param {{ post: import('@/features/post-list/postQuery').PostWithAssets; onPressAsset?: (asset: import('@/sync/db/schema').AssetRow) => void; isTextSelectable?: boolean; meta?: import('react').ReactNode; children?: import('react').ReactNode }} props
 */
export default function PostView({ post, onPressAsset, isTextSelectable = false, meta, children }) {
  const { text, postAssets, postedAt } = post;

  return (
    <Card testID="post-card" style={styles.card}>
      {isPresent(postAssets) && (
        <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} onPressAsset={onPressAsset} />
      )}
      <View style={[styles.body, !isPresent(postAssets) && styles.bodyTextOnly]}>
        {isPresent(text) && <Text selectable={isTextSelectable}>{text}</Text>}
        <View style={styles.meta}>
          <PostPostedAt postedAt={postedAt} />
          {meta}
        </View>
        {children}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: layout.postCardPadding,
    gap: layout.postCardGap,
  },
  body: {
    paddingHorizontal: layout.postTextInset,
    paddingBottom: layout.postTextBottom,
    gap: layout.cardGap,
  },
  // Without pictures the text starts as far from the card's top as from its sides.
  bodyTextOnly: {
    paddingTop: layout.postTextInset,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.cardGap,
    minHeight: scale(20),
  },
});
