import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import { layout, press, radii, sizes } from '@/styles/designTokens';

const AnimatedCard = Animated.createAnimatedComponent(Card);

type AnimatedViewProps = ComponentProps<typeof Animated.View>;

type PostRowCardProps = {
  asset?: ComponentProps<typeof CoverImage>['asset'];
  moreCount?: number;
  onPressAsset?: () => void;
  onPress?: () => void;
  /** What a tap on the card opens, for VoiceOver ("Open the post"); with `onPress`. */
  openLabel?: string;
  entering?: AnimatedViewProps['entering'];
  exiting?: AnimatedViewProps['exiting'];
  style?: StyleProp<ViewStyle>;
  contentStyle?: AnimatedViewProps['style'];
  contentExiting?: AnimatedViewProps['exiting'];
  /** What goes across the card's full width above the tile and the column (a copy's warnings). */
  header?: ReactNode;
  children?: ReactNode;
};

/**
 * A post as a row card, on a post card's geometry (PostView's): its picture `asset` as a tile close
 * to the card's edge ("+N" for `moreCount` more), and `children` in a column inset so its text starts
 * at cardInset from every edge, like a post's text; without a picture the column fills the card.
 * With `onPressAsset` a tap on the tile opens it; without it the tile takes no touch. With `onPress`
 * a tap elsewhere on the card opens what it stands for (the post, a copy), pressed like a row; the
 * card stays out of VoiceOver's way, so the controls in it are each reachable, and the tile is the
 * button that opens it (`openLabel`). `entering` and
 * `exiting` are Reanimated layout animations of the card, `contentStyle` and `contentExiting` an
 * animated style and exiting animation of what's in it (an unfolding thread's). `header` sits above
 * the tile and the column, across the card. style is for layout only.
 */
export default function PostRowCard({
  asset,
  moreCount = 0,
  onPressAsset,
  onPress,
  openLabel,
  entering,
  exiting,
  style,
  contentStyle,
  contentExiting,
  header,
  children,
}: PostRowCardProps) {
  const tile = asset && <CoverImage asset={asset} moreCount={moreCount} style={styles.tile} />;

  const card = (
    <AnimatedCard entering={entering} exiting={exiting} style={[styles.card, style]}>
      {header && <View style={styles.header}>{header}</View>}
      <Animated.View exiting={contentExiting} style={[styles.content, contentStyle]}>
        {tile && (onPressAsset || onPress) ? (
          <Pressable
            onPress={onPressAsset ?? onPress}
            accessibilityRole="button"
            accessibilityLabel={onPressAsset ? undefined : openLabel}
          >
            {tile}
          </Pressable>
        ) : (
          tile
        )}
        <View style={styles.column}>{children}</View>
      </Animated.View>
    </AnimatedCard>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} accessible={false} style={({ pressed }) => pressed && press.flat}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: layout.postCardPadding,
  },
  header: {
    gap: layout.cardGap,
    marginBottom: layout.cardGap,
  },
  // The column's own inset makes up the rest of the room between the tile and the text.
  content: {
    flexDirection: 'row',
    gap: layout.rowLeadingGap - layout.postTextInset,
  },
  tile: {
    width: sizes.postTile.width,
    height: sizes.postTile.height,
    borderRadius: radii.postPicture,
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: layout.cardGap,
    paddingTop: layout.postTextInset,
    paddingHorizontal: layout.postTextInset,
    paddingBottom: layout.postTextBottom,
  },
});
