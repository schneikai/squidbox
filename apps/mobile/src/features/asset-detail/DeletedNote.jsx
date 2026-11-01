import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, shadows, sizes, typography } from '@/styles/designTokens';

// The red note on a trashed photo or video (opened from a post it's still in): where it is. The
// parent positions it through `style`.
export default function DeletedNote({ style }) {
  return (
    <View style={[styles.note, style]} accessibilityRole="text">
      <Icon name="trash" size={sizes.menuIcon} color={colors.text.inverse} />
      <Text style={styles.text}>In the Deleted album</Text>
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
