import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import SuperPressable from '@/components/SuperPressable';
import Text from '@/components/Text';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

/**
 * A following post of a thread as a row card (the post screen, an unfolded thread in the posts
 * list): its first picture as a tile ("+N" when it has more), its text beside it. With
 * `onOpenAsset(asset)` a tap on the tile opens the picture and a long press copies the text; without
 * it (inside something pressable, the posts list) it takes no touches of its own.
 */
export default function ThreadPost({ post, onOpenAsset }) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);
  const tile = first && (
    <CoverImage asset={first} style={styles.tile}>
      {more.length > 0 && <ThumbnailBadge label={`+${more.length}`} style={styles.more} />}
    </CoverImage>
  );

  return (
    <Card style={styles.card}>
      {tile && onOpenAsset ? <SuperPressable onPress={() => onOpenAsset(first)}>{tile}</SuperPressable> : tile}
      {isPresent(post.text) && (
        <Text selectable={!!onOpenAsset} style={styles.text}>
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
