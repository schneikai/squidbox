import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import CoverImage from '@/components/CoverImage';
import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, scale, spacing } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const THUMBNAIL_SIZE = scale(72);

/**
 * A row of a list of albums or posts, as Apple Photos lists albums: `asset`'s thumbnail
 * (CoverImage), a one-line `title` (the album's name, the post's caption) over a smaller grey
 * `subtitle` (its count, when it was posted), and a separator inset to the text unless `isLast`.
 * The whole row is pressable.
 */
export default function ThumbnailRow({ asset, title, subtitle, isLast, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <CoverImage asset={asset} style={styles.thumbnail} />
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
        <Icon name="chevron-right" size={spacing.iconSizeSmall} color={colors.textTertiary} />
        {!isLast && <View style={[actionButtonStyles.listDivider, styles.divider]} />}
      </View>
    </TouchableOpacity>
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
