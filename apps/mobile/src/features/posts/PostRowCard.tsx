import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import Icon from '@/components/Icon';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { colors, layout, press, radii, sizes } from '@/styles/designTokens';

const AnimatedCard = Animated.createAnimatedComponent(Card);

type AnimatedViewProps = ComponentProps<typeof Animated.View>;

type PostRowCardProps = {
  asset?: ComponentProps<typeof CoverImage>['asset'];
  moreCount?: number;
  badge?: string;
  onPressAsset?: () => void;
  onPress?: () => void;
  accessibilityLabel?: string;
  entering?: AnimatedViewProps['entering'];
  exiting?: AnimatedViewProps['exiting'];
  style?: StyleProp<ViewStyle>;
  contentStyle?: AnimatedViewProps['style'];
  contentExiting?: AnimatedViewProps['exiting'];
  children?: ReactNode;
};

/**
 * A post as a row card, on a post card's geometry (PostView's): its picture `asset` as a tile close
 * to the card's edge ("+N" for `moreCount` more), and `children` in a column inset so its text starts
 * at cardInset from every edge, like a post's text; without a picture the column fills the card.
 * With `onPressAsset` a tap on the tile opens it; without it the tile takes no touch. `badge` is a
 * text in the tile's corner in place of "+N" (a video's length). `onPress` makes the whole card a
 * button that opens what it stands for, with a chevron at its end (`accessibilityLabel` names it). `entering` and
 * `exiting` are Reanimated layout animations of the card, `contentStyle` and `contentExiting` an
 * animated style and exiting animation of what's in it (an unfolding thread's). style is for layout
 * only.
 */
export default function PostRowCard({
  asset,
  moreCount = 0,
  badge,
  onPressAsset,
  onPress,
  accessibilityLabel,
  entering,
  exiting,
  style,
  contentStyle,
  contentExiting,
  children,
}: PostRowCardProps) {
  const tile = asset && (
    <CoverImage asset={asset} moreCount={badge ? 0 : moreCount} style={styles.tile}>
      {!!badge && <ThumbnailBadge label={badge} corner="bottomRight" />}
    </CoverImage>
  );
  const content = (
    <Animated.View exiting={contentExiting} style={[styles.content, contentStyle]}>
      {tile && onPressAsset ? <Pressable onPress={onPressAsset}>{tile}</Pressable> : tile}
      <View style={styles.column}>{children}</View>
      {onPress && (
        <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} style={styles.chevron} />
      )}
    </Animated.View>
  );

  return (
    <AnimatedCard entering={entering} exiting={exiting} style={[styles.card, style]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => pressed && press.flat}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: layout.postCardPadding,
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
  chevron: {
    alignSelf: 'center',
    marginRight: layout.postTextInset,
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
