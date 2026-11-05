import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, scale, shadows, sizes, typography } from '@/styles/designTokens';

// The tray's inset, which a row that scrolls inside it bleeds out to (TRAY_INSET).
export const TRAY_INSET = scale(12);

/**
 * The assistant's look for a group of its actions: a lavender tray, lit along its edge, under a
 * violet sparkle and `title` (Write with AI). `trailing` sits at the end of the title's line (a
 * small button), `children` under it. style is for layout only.
 */
export default function AssistantTray({ title, trailing, children, style }) {
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} />
        <Text style={styles.title}>{title}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    paddingTop: TRAY_INSET,
    paddingBottom: TRAY_INSET,
    paddingHorizontal: TRAY_INSET,
    gap: scale(8),
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.background.assistant,
    boxShadow: shadows.litEdge.boxShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    minHeight: sizes.smallButton,
    paddingHorizontal: 2,
  },
  title: {
    flex: 1,
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.accent.base,
  },
});
