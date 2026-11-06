import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import { colors, layout, lineHeights, radii, shadows, sizes, space } from '@/styles/designTokens';

type NoteProps = {
  tone: 'warning' | 'tint' | 'muted' | 'card';
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A tinted block inside content: `tone` warning (a sticky note's yellow, WarningNote), tint (lavender,
 * an example on a white sheet), muted (the page's grey, a tweet on a card) or card (a white card on
 * the page, like Card: New contact's fill note). `icon` leads it, centred on the first line of
 * `size="small"` text, or `leading` in its place (a mark of its own, centred on the row); `trailing`
 * ends it (a Button), centred, a step
 * from the edge so a disc's own room makes up the inset. `children` is its text (Text). style is for
 * layout only.
 */
export default function Note({ tone, icon, leading, trailing, accessibilityRole, style, children }: NoteProps) {
  return (
    <View
      style={[styles.note, toneStyles[tone], trailing != null && styles.withTrailing, style]}
      accessibilityRole={accessibilityRole}
    >
      {icon && <Icon name={icon} size={sizes.iconSmall} color={colors.text.primary} style={styles.icon} />}
      {!icon && leading}
      <View style={styles.content}>{children}</View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    paddingHorizontal: layout.cardInset,
    paddingVertical: layout.rowPaddingYCompact,
    borderRadius: radii.card,
  },
  withTrailing: {
    paddingRight: space.sm,
  },
  icon: {
    alignSelf: 'flex-start',
    marginTop: (lineHeights.subheadline - sizes.iconSmall) / 2,
  },
  content: {
    flex: 1,
  },
});

const toneStyles = StyleSheet.create({
  warning: { backgroundColor: colors.background.note },
  tint: { backgroundColor: colors.background.tint },
  muted: { backgroundColor: colors.background.base },
  card: { backgroundColor: colors.background.surface, ...shadows.card },
});
