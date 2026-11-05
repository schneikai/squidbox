import { View, Text, StyleSheet } from 'react-native';

import { colors, layout, space, typography } from '@/styles/designTokens';

/**
 * A section label above grouped rows or content: Settings and its screens, the asset's details,
 * a post.
 *
 * When trailing is provided the component renders a flex row with the title
 * on the left and the slot on the right. Over cards it sits a little in from
 * their edge; `isFlush` lines it up with content that has no card around it.
 */
export default function ScreenSectionHeader({ title, trailing, isFlush = false }) {
  if (!trailing) {
    return <Text style={[styles.label, isFlush && styles.flush]}>{title}</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.labelInRow, isFlush && styles.flush]}>{title}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: space.sm,
    marginLeft: layout.rowInset, // over the rows' text
    marginTop: layout.sectionGap,
  },
  labelInRow: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: layout.rowInset,
  },
  flush: {
    marginLeft: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.sm,
    marginTop: layout.sectionGap,
  },
});
