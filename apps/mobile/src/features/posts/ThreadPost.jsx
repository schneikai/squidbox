import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import SuperPressable from '@/components/SuperPressable';
import Text from '@/components/Text';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { layout, scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

const AnimatedCard = Animated.createAnimatedComponent(Card);

/**
 * A following post of a thread as a row card (the post screen, an unfolded thread in the posts
 * list): its first picture as a tile ("+N" when it has more), its text beside it. With
 * `onOpenAsset(asset)` a tap on the tile opens the picture; without it (inside something pressable,
 * the posts list) the tile takes no touch. `isTextSelectable` lets a long press copy the text.
 * `entering` and `exiting` are Reanimated layout animations of the card, and `contentStyle` and
 * `contentExiting` an animated style and exiting animation of what's in it (an unfolding thread's);
 * `style` is for layout only.
 */
export default function ThreadPost({
  post,
  onOpenAsset,
  isTextSelectable = false,
  entering,
  exiting,
  style,
  contentStyle,
  contentExiting,
}) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);
  const tile = first && (
    <CoverImage asset={first} style={styles.tile}>
      {more.length > 0 && <ThumbnailBadge label={`+${more.length}`} style={styles.more} />}
    </CoverImage>
  );

  return (
    <AnimatedCard entering={entering} exiting={exiting} style={[styles.card, style]}>
      <Animated.View exiting={contentExiting} style={[styles.content, contentStyle]}>
        {tile && onOpenAsset ? <SuperPressable onPress={() => onOpenAsset(first)}>{tile}</SuperPressable> : tile}
        {isPresent(post.text) && (
          <Text selectable={isTextSelectable} style={[styles.text, tile && styles.textBesideTile]}>
            {post.text}
          </Text>
        )}
      </Animated.View>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: layout.postCardPadding,
  },
  // The text's own inset makes up the rest of the room between the tile and the text.
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.postCardGap - layout.postTextInset,
  },
  tile: {
    width: scale(84),
    height: scale(112),
  },
  // Inset like a post's text in PostView, so it starts at the same place.
  text: {
    flex: 1,
    paddingHorizontal: layout.postTextInset,
    paddingBottom: layout.postTextBottom,
  },
  // Its first line a little below the tile's top.
  textBesideTile: {
    paddingTop: layout.postTextInset,
  },
  more: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
  },
});
