import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import ListDivider from '@/components/ListDivider';
import { SCREEN_PADDING } from '@/constants';
import { colors, lineHeights, radii, shadows, sizes, typography } from '@/styles/designTokens';

// iOS-style grouped-list building blocks shared by the Settings screen and its detail screens
// (Backup, Sync), so they all look and behave the same.

export function Section({ children }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  return (
    <View style={styles.section}>
      {kids.map((child, i) => (
        <View key={i}>
          {child}
          {i < kids.length - 1 && <ListDivider />}
        </View>
      ))}
    </View>
  );
}

// iOS-style small gray explanatory text shown BELOW a grouped section.
export function SectionFooter({ children }) {
  return <Text style={styles.footer}>{children}</Text>;
}

// `isValueMuted` greys the value further, for one that no longer applies. `isValueTruncated` keeps
// the value to one line, shortened with an ellipsis, so the label keeps its width.
export function Row({ label, value, isValueMuted, isValueTruncated, onPress, destructive, chevron, children }) {
  const content = (
    <View style={styles.row}>
      <Text
        style={[styles.rowLabel, isValueTruncated && styles.rowLabelKept, destructive && styles.rowLabelDestructive]}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text
            style={[styles.rowValue, isValueMuted && styles.rowValueMuted]}
            numberOfLines={isValueTruncated ? 1 : undefined}
          >
            {value}
          </Text>
        ) : null}
        {children}
        {chevron && (
          <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} style={{ marginLeft: 4 }} />
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
    backgroundColor: colors.background.glass,
    borderRadius: radii.card,
    marginBottom: 4,
    ...shadows.section,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.iconButton,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  rowLabelKept: {
    flexBasis: 'auto',
    flexShrink: 0,
  },
  rowLabelDestructive: {
    color: colors.status.danger,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 8,
  },
  rowValue: {
    fontSize: typography.body,
    color: colors.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueMuted: {
    color: colors.text.tertiary,
  },
  footer: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
    marginTop: 8,
    marginLeft: 4,
    marginRight: 4,
    lineHeight: lineHeights.footnote,
  },
});
