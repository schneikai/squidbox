import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  Pressable,
  Text as RNText,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
} from 'react-native';

import type { Palette } from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { colors, layout, press, sizes, space, textStyles } from '@/styles/designTokens';

// iOS-style grouped-list building blocks shared by the Settings screen and its detail screens
// (Backup, Sync), so they all look and behave the same.

export type SectionProps = { children: ReactNode; isHeaderless?: boolean };

// `isHeaderless`: a section without a header above it, set apart from the one before like a headed one.
export function Section({ children, isHeaderless = false }: SectionProps) {
  const kids = Children.toArray(children);
  return (
    <Card style={[styles.section, isHeaderless && styles.headerless]}>
      {kids.map((child, i) => (
        // A text child has no key.
        <View key={(isValidElement(child) ? child.key : null) ?? i}>
          {child}
          {i < kids.length - 1 && <Divider />}
        </View>
      ))}
    </Card>
  );
}

export type SectionFooterProps = { children?: ReactNode };

// iOS-style small gray explanatory text shown BELOW a grouped section.
export function SectionFooter({ children }: SectionFooterProps) {
  return (
    <Text variant="hint" style={styles.footer}>
      {children}
    </Text>
  );
}

export type RowProps = {
  label: string | ReactElement;
  description?: string | null;
  leading?: ReactNode;
  value?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  colorPalette?: Extract<Palette, 'danger'>;
  hasChevron?: boolean;
  isSelected?: boolean;
  size?: 'regular' | 'small';
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children?: ReactNode;
};

// The label always keeps its width; a long value wraps onto more lines beside it, as Apple's
// guidance prefers over truncating or shrinking text.
// `label` is its text, or a component that takes the label's place (a model's summary). `leading`
// goes before it (an icon), `description` is secondary text under it. `hasChevron` ends it with a
// chevron (it opens a screen) while nothing else is at its end: `children` (a list's avatars) take
// the chevron's place, a value keeps it beside it, `isSelected` with the accent check (the current one).
// `colorPalette="danger"` for one that deletes or signs out; `size="small"` for a tighter row in a
// long list (a pick row, a photo's). `disabled` keeps it from taking presses; `accessibilityRole`
// (a button by default) and `accessibilityState` say what a pressable one is (a checkbox, checked).
// `onLongPress` is for a row with a menu of its own (a list's Edit and Delete), on a pressable row.
// `leading` may be several parts (a status icon and a thumbnail), set in a row.
export function Row({
  label,
  description,
  leading,
  value,
  onPress,
  onLongPress,
  disabled = false,
  colorPalette,
  hasChevron,
  isSelected = false,
  size = 'regular',
  accessibilityRole = 'button',
  accessibilityState,
  children,
}: RowProps) {
  const hasTrailing = Children.toArray(children).length > 0;
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
        {hasChevron && !hasTrailing && (
          <Icon
            name="chevron-right"
            size={sizes.iconSmall}
            color={colors.text.tertiary}
            style={value && styles.chevronAfterValue}
          />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled, selected: isSelected, ...accessibilityState }}
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
    marginTop: layout.sectionGap,
  },
  section: {
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.iconButton,
    paddingHorizontal: layout.rowInset,
    paddingVertical: layout.rowPaddingY,
  },
  rowLabel: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  rowSmall: {
    paddingVertical: layout.rowPaddingYCompact,
  },
  // A value's chevron a little apart from it; a bare label's sits at rowRight's gap, like ThumbnailRow's.
  chevronAfterValue: {
    marginLeft: space.xs,
  },
  rowLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    marginRight: layout.rowLeadingGap,
  },
  rowText: {
    flex: 1,
    gap: space.hair,
  },
  // With a value the label takes its own width and the value the rest, so a long one wraps
  // instead of squeezing the label away.
  rowTextKept: {
    gap: space.hair,
    flexShrink: 0,
  },
  rowDescription: {
    ...textStyles.subheadline,
    color: colors.text.secondary,
  },
  rowLabelDanger: {
    color: colors.status.danger,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: space.sm,
  },
  rowRightFilling: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rowValue: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  footer: {
    marginTop: space.sm,
    marginHorizontal: layout.rowInset, // under the rows' text
  },
});
