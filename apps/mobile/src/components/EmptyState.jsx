import { View, Text, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import { colors, scale, typography } from '@/styles/designTokens';

/**
 * Centred icon + title + optional subtitle.
 * Used for empty lists, no-result states, and zero-content placeholders.
 *
 * style applies to the outer container View.
 */
export default function EmptyState({ icon, title, subtitle, style }) {
  return (
    <View style={[styles.container, style]}>
      <Icon name={icon} size={scale(44)} color={colors.textTertiary} />
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
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.subheadline,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
