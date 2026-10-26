import { Children } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import ListDivider from '@/components/ListDivider';
import { SCREEN_PADDING } from '@/constants';
import { colors, lineHeights, radii, shadows, sizes, typography } from '@/styles/designTokens';

// iOS-style grouped-list building blocks shared by the Settings screen and its detail screens
// (Backup, Sync), so they all look and behave the same.

// `isHeaderless`: a section without a header above it, set apart from the one before like a headed one.
export function Section({ children, isHeaderless = false }) {
  const kids = Children.toArray(children);
  return (
    <View style={[styles.section, isHeaderless && styles.headerless]}>
      {kids.map((child, i) => (
        <View key={child.key ?? i}>
          {child}
          {i < kids.length - 1 && <ListDivider />}
        </View>
      ))}
    </View>
  );
}

// iOS-style small gray explanatory text shown BELOW a grouped section. `isMuted` greys it further,
// for a value that couldn't be read.
export function SectionFooter({ children, isMuted = false }) {
  return <Text style={[styles.footer, isMuted && styles.footerMuted]}>{children}</Text>;
}

// `isValueMuted` greys the value further, for one that no longer applies. `isValueTruncated` keeps
// the value to one line, shortened with an ellipsis, so the label keeps its width. `leading` goes
// before the label (an icon), `description` is secondary text under it.
export function Row({
  label,
  description,
  leading,
  value,
  isValueMuted,
  isValueTruncated,
  onPress,
  destructive,
  chevron,
  children,
}) {
  const content = (
    <View style={styles.row}>
      {leading != null && <View style={styles.rowLeading}>{leading}</View>}
      <View style={[styles.rowText, isValueTruncated && styles.rowTextKept]}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {description != null && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
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
  headerless: {
    marginTop: 20,
  },
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
    fontSize: typography.body,
    color: colors.text.primary,
  },
  rowLeading: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTextKept: {
    flexBasis: 'auto',
    flexShrink: 0,
  },
  rowDescription: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.secondary,
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
  footerMuted: {
    color: colors.text.tertiary,
  },
});
