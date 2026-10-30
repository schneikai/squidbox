import { Children } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { SCREEN_PADDING } from '@/constants';
import { colors, lineHeights, press, sizes, typography } from '@/styles/designTokens';

// iOS-style grouped-list building blocks shared by the Settings screen and its detail screens
// (Backup, Sync), so they all look and behave the same.

// `isHeaderless`: a section without a header above it, set apart from the one before like a headed one.
export function Section({ children, isHeaderless = false }) {
  const kids = Children.toArray(children);
  return (
    <Card style={[styles.section, isHeaderless && styles.headerless]}>
      {kids.map((child, i) => (
        <View key={child.key ?? i}>
          {child}
          {i < kids.length - 1 && <Divider />}
        </View>
      ))}
    </Card>
  );
}

// iOS-style small gray explanatory text shown BELOW a grouped section.
export function SectionFooter({ children }) {
  return (
    <Text variant="hint" style={styles.footer}>
      {children}
    </Text>
  );
}

// The label always keeps its width; a long value wraps onto more lines beside it, as Apple's
// guidance prefers over truncating or shrinking text.
// `label` is its text, or a component that takes the label's place (a model's summary). `leading`
// goes before it (an icon), `description` is secondary text under it. `hasChevron` ends it with a
// chevron (it opens a screen), `isSelected` with the accent check (the current one).
// `colorPalette="danger"` for one that deletes or signs out; `size="small"` for a tighter row in a
// long list. `disabled` keeps it from taking presses.
export function Row({
  label,
  description,
  leading,
  value,
  onPress,
  disabled = false,
  colorPalette,
  hasChevron,
  isSelected = false,
  size = 'regular',
  children,
}) {
  const content = (
    <View style={[styles.row, size === 'small' && styles.rowSmall]}>
      {leading != null && <View style={styles.rowLeading}>{leading}</View>}
      <View style={value ? styles.rowTextKept : styles.rowText}>
        {typeof label === 'string' ? (
          <RNText style={[styles.rowLabel, colorPalette === 'danger' && styles.rowLabelDanger]}>{label}</RNText>
        ) : (
          label
        )}
        {description != null && <RNText style={styles.rowDescription}>{description}</RNText>}
      </View>
      <View style={[styles.rowRight, value && styles.rowRightFilling]}>
        {value ? <RNText style={styles.rowValue}>{value}</RNText> : null}
        {children}
        {isSelected && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
        {hasChevron && (
          <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} style={styles.chevron} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isSelected }}
        style={({ pressed }) => pressed && !disabled && press.flat}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  headerless: {
    marginTop: 20,
  },
  section: {
    marginBottom: 4,
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
  rowSmall: {
    paddingVertical: 12,
  },
  chevron: {
    marginLeft: 4,
  },
  rowLeading: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  // With a value the label takes its own width and the value the rest, so a long one wraps
  // instead of squeezing the label away.
  rowTextKept: {
    gap: 2,
    flexShrink: 0,
  },
  rowDescription: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.secondary,
  },
  rowLabelDanger: {
    color: colors.status.danger,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 8,
  },
  rowRightFilling: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rowValue: {
    fontSize: typography.body,
    color: colors.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  footer: {
    marginTop: 8,
    marginHorizontal: 4,
  },
});
