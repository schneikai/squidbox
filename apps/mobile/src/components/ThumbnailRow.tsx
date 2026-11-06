import { Pressable, StyleSheet, Text, View } from 'react-native';

import CoverImage, { type CoverImageProps } from '@/components/CoverImage';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import { colors, layout, press, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

export type ThumbnailRowProps = {
  asset?: CoverImageProps['asset'];
  hasThumbnail?: boolean;
  title: string;
  subtitle?: string;
  isLast?: boolean;
  onPress: () => void;
};

/**
 * A row of a list of albums or posts, as Apple Photos lists albums: `asset`'s thumbnail
 * (CoverImage; none without `hasThumbnail`), a one-line `title` (the album's name, the post's
 * caption) over a smaller grey `subtitle` (its count, when it was posted), and a separator inset to
 * the text unless `isLast`. The whole row is pressable.
 */
export default function ThumbnailRow({
  asset,
  hasThumbnail = true,
  title,
  subtitle,
  isLast,
  onPress,
}: ThumbnailRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && press.flat]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {hasThumbnail && <CoverImage asset={asset} style={styles.thumbnail} />}
      <View style={styles.text}>
        <View style={styles.labels}>
          <Text style={listTextStyles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={listTextStyles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
        {!isLast && <Divider style={styles.divider} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: layout.rowLeadingGap,
  },
  // The row's vertical room is on the thumbnail, not the row, so the divider stays at its bottom.
  thumbnail: {
    width: sizes.thumbnail,
    height: sizes.thumbnail,
    marginVertical: layout.rowPaddingYCompact,
  },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  // The lists' divider, inset to the text.
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    marginLeft: 0,
  },
  labels: {
    flex: 1,
  },
});
