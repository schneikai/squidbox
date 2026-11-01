import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, shadows, sizes, typography } from '@/styles/designTokens';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

// The red note on a trashed photo or video (opened from a post it's still in), of `mediaType`,
// under the header.
export default function DeletedNote({ mediaType }) {
  return (
    <View style={styles.note} accessibilityRole="text">
      <Icon name="trash" size={sizes.menuIcon} color={colors.text.inverse} />
      <Text style={styles.text}>This {humanizeMediaType(mediaType).toLowerCase()} was deleted</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.status.danger,
    ...shadows.floating,
  },
  text: {
    color: colors.text.inverse,
    fontSize: typography.footnote,
    fontWeight: '600',
  },
});
