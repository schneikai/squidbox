import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import { colors, lineHeights, scale, typography } from '@/styles/designTokens';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Centred icon + title + optional subtitle.
 * Used for empty lists, no-result states, and zero-content placeholders.
 *
 * style applies to the outer container View.
 */
export default function EmptyState({ icon, title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Icon name={icon} size={scale(44)} color={colors.text.tertiary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: lineHeights.subheadline,
  },
});
