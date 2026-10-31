import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import SuperPressable from '@/components/SuperPressable';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { colors, lineHeights, scale, typography } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

const TILE = { width: scale(84), height: scale(112) };

/**
 * A following post of a thread on the post screen, as a card: its first picture as a tile ("+N" when
 * it has more; a tap opens them, `onOpenAsset(asset)`), its text and Copy (`onCopy`) when it has text.
 */
export default function ThreadPost({ post, onOpenAsset, onCopy }) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);

  return (
    <Card style={styles.card}>
      {first && (
        <SuperPressable onPress={() => onOpenAsset(first)}>
          <CoverImage asset={first} style={TILE}>
            {more.length > 0 && <ThumbnailBadge label={`+${more.length}`} style={styles.more} />}
          </CoverImage>
        </SuperPressable>
      )}
      <View style={styles.body}>
        {isPresent(post.text) && <Text style={styles.text}>{post.text}</Text>}
        {isPresent(post.text) && (
          <Button variant="tertiary" size="small" icon="copy" label="Copy" onPress={onCopy} style={styles.copy} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(8),
    gap: scale(12),
  },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: scale(102),
    paddingTop: scale(6),
    paddingLeft: scale(6),
    justifyContent: 'space-between',
    gap: scale(10),
  },
  text: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  copy: {
    alignSelf: 'flex-end',
  },
  more: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
  },
});
