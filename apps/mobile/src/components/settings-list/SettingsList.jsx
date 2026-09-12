import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, radii, spacing, typography } from '@/styles/designTokens';

// iOS-style grouped-list building blocks shared by the Settings screen and its detail screens
// (Backup, Sync), so they all look and behave the same.

export function Section({ children }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  return (
    <View style={styles.section}>
      {kids.map((child, i) => (
        <View key={i}>
          {child}
          {i < kids.length - 1 && <View style={actionButtonStyles.listDivider} />}
        </View>
      ))}
    </View>
  );
}

export function Row({ label, value, onPress, destructive, chevron, children }) {
  const content = (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {children}
        {chevron && (
          <Icon
            name="chevron-right"
            size={spacing.iconSizeSmall}
            color={colors.textTertiary}
            style={{ marginLeft: 4 }}
          />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.iconButtonSize,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 8,
  },
  rowValue: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
});
