import { Pressable, StyleSheet, Text, View } from 'react-native';

import CoverImage from '@/components/CoverImage';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import { colors, press, scale, sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const THUMBNAIL_SIZE = scale(72);

/**
 * A row of a list of albums or posts, as Apple Photos lists albums: `asset`'s thumbnail
 * (CoverImage; none without `hasThumbnail`), a one-line `title` (the album's name, the post's
 * caption) over a smaller grey `subtitle` (its count, when it was posted), and a separator inset to
 * the text unless `isLast`. The whole row is pressable.
 */
export default function ThumbnailRow({ asset, hasThumbnail = true, title, subtitle, isLast, onPress }) {
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
    gap: 12,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginVertical: 6,
  },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
