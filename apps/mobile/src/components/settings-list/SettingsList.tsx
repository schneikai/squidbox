import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  Pressable,
  Text as RNText,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityRole,
  type AccessibilityState,
  type ViewProps,
} from 'react-native';

import type { Palette } from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import RowSlots from '@/components/RowSlots';
import Text from '@/components/Text';
import longPressAccessibility from '@/lib/longPressAccessibility';
import { colors, layout, press, space, textStyles } from '@/styles/designTokens';

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
  accessibilityActions?: ViewProps['accessibilityActions'];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  children?: ReactNode;
};

// A row of a section card, laid out in RowSlots (its slots, chevron and pick rules hold here).
// The label always keeps its width; a long value wraps onto more lines beside it, as Apple's
// guidance prefers over truncating or shrinking text.
// `label` is its text, or a component that takes the label's place (a model's summary). `leading`
// goes before it (an icon), `description` is secondary text under it. `children` go at its
// end (a list's avatars) and take `hasChevron`'s chevron's place; `isSelected` makes it a pick-one row.
// `colorPalette="danger"` for one that deletes or signs out; `size="small"` for a tighter row in a
// long list (a pick row, a photo's). `disabled` keeps it from taking presses; `accessibilityRole`
// (a button by default) and `accessibilityState` say what a pressable one is (a checkbox, checked).
// `onLongPress` is for a row with a menu of its own (a list's Edit and Delete): with it alone the row
// takes a hold and no tap (a channel's Delete), with no press highlight and no button role.
// `accessibilityActions` are its other actions for VoiceOver (a channel's Move up), handled by
// `onAccessibilityAction`.
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
  isSelected,
  size = 'regular',
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityActions,
  onAccessibilityAction,
  children,
}: RowProps) {
  const content = (
    <RowSlots
      leading={leading}
      isSelected={isSelected}
      value={value ? <RNText style={styles.rowValue}>{value}</RNText> : null}
      trailing={Children.toArray(children).length > 0 ? children : null}
      hasChevron={hasChevron}
      size={size}
    >
      {typeof label === 'string' ? (
        <RNText style={[styles.rowLabel, colorPalette === 'danger' && styles.rowLabelDanger]}>{label}</RNText>
      ) : (
        label
      )}
      {description != null && <RNText style={styles.rowDescription}>{description}</RNText>}
    </RowSlots>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        {...longPressAccessibility(onLongPress, {
          actions: accessibilityActions,
          onOtherAction: onAccessibilityAction,
        })}
        disabled={disabled}
        accessibilityRole={onPress ? accessibilityRole : undefined}
        accessibilityState={{ disabled, selected: !!isSelected, ...accessibilityState }}
        style={({ pressed }) => !!onPress && pressed && !disabled && press.flat}
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
  rowLabel: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  rowDescription: {
    ...textStyles.subheadline,
    color: colors.text.secondary,
  },
  rowLabelDanger: {
    color: colors.status.danger,
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
