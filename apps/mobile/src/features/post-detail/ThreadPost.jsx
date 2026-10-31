import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import SuperPressable from '@/components/SuperPressable';
import Text from '@/components/Text';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

/**
 * A following post of a thread on the post screen, as a card: its first picture as a tile ("+N" when
 * it has more; a tap opens them, `onOpenAsset(asset)`), its text, which a long press copies.
 */
export default function ThreadPost({ post, onOpenAsset }) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);

  return (
    <Card style={styles.card}>
      {first && (
        <SuperPressable onPress={() => onOpenAsset(first)}>
          <CoverImage asset={first} style={styles.tile}>
            {more.length > 0 && <ThumbnailBadge label={`+${more.length}`} style={styles.more} />}
          </CoverImage>
        </SuperPressable>
      )}
      {isPresent(post.text) && (
        <Text selectable style={styles.text}>
          {post.text}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(10),
    gap: scale(12),
  },
  tile: {
    width: scale(84),
    height: scale(112),
  },
  text: {
    flex: 1,
    paddingTop: scale(6),
  },
  more: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
  },
});
