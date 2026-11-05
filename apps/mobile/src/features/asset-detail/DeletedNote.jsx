import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, layout, radii, shadows, sizes, space, textStyles } from '@/styles/designTokens';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

// The red note on a trashed photo or video (opened from a post it's still in), of `mediaType`,
// under the header.
export default function DeletedNote({ mediaType }) {
  return (
    <View style={[styles.note, shadows.floating]} accessibilityRole="text">
      <Icon name="trash" size={sizes.menuIcon} color={colors.text.inverse} />
      <Text style={[textStyles.footnoteBold, styles.text]}>
        This {humanizeMediaType(mediaType).toLowerCase()} was deleted
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.status.danger,
  },
  text: {
    color: colors.text.inverse,
  },
});
