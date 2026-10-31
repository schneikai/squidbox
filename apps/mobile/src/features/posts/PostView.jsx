import { StyleSheet, View } from 'react-native';

import PostImage from './PostImage';

import Card from '@/components/Card';
import Text from '@/components/Text';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

/**
 * A post as a card: its pictures (`onPressAsset(asset)` makes each open), its text, then a row with
 * when it was posted and `meta` (what else the place shows about it: a thread's size, the heart,
 * Copy), and `children` under that row (buttons for this post). `post` is a postQuery row: it carries
 * its `postAssets` ([{ id, asset }]).
 */
export default function PostView({ post, onPressAsset, meta, children }) {
  const { text, postAssets, postedAt } = post;

  return (
    <Card style={styles.card}>
      {isPresent(postAssets) && (
        <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} onPressAsset={onPressAsset} />
      )}
      <View style={styles.body}>
        {isPresent(text) && <Text>{text}</Text>}
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
    padding: scale(10),
    gap: scale(12),
  },
  body: {
    paddingHorizontal: scale(6),
    paddingBottom: scale(4),
    gap: scale(10),
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    minHeight: scale(20),
  },
});
