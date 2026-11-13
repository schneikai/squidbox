import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import Icon from '@/components/Icon';
import chipFrame from '@/styles/chipFrame';
import { colors, press, reflow, shadows, sizes, space, textStyles } from '@/styles/designTokens';

type BubbleProps = {
  label: string;
  mark?: ReactNode;
  isSelected?: boolean;
  isMarkOnly?: boolean;
  hasCaret?: boolean;
  variant?: 'add';
  onPress?: () => void;
  accessibilityRole?: 'tab' | 'button';
  isExpanded?: boolean;
  isGrouped?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The round bubble's side: a chip's height.
const ROUND = sizes.smallButton + space.sm;

/**
 * One choice of a bar of bubbles (a post's channels): a grey pill with its `mark` (a logo) and its
 * `label`, or, `isSelected`, a white raised one, and with `hasCaret` a ⌄ (it opens a menu). The label
 * has one weight either way, so selecting doesn't change the width. `isMarkOnly` is a grey disc holding
 * only the mark (a post's channels on its card in a list); without a mark it still shows its label, so
 * it never shows empty. `variant="add"` is the dashed + after them. `label` is always what VoiceOver reads; a bubble is a tab (selected or
 * not) unless `accessibilityRole` says button (the +); `isExpanded` tells, on one that opens a menu,
 * whether it is open. A width change (the caret coming, a new label) glides (`reflow`). Without `onPress` it is a plain view, so it
 * can sit where nothing is to be pressed. `isGrouped` is one of a group its parent names as one (a
 * post's channels on its card in a list): VoiceOver skips it. style is for layout only.
 */
export default function Bubble({
  label,
  mark,
  isSelected = false,
  isMarkOnly = false,
  hasCaret = false,
  variant,
  onPress,
  accessibilityRole = 'tab',
  isExpanded,
  isGrouped = false,
  style,
}: BubbleProps) {
  const isAdd = variant === 'add';
  const isRound = isAdd || (!!mark && isMarkOnly);
  const frame = [
    chipFrame,
    styles.bubble,
    isRound && styles.round,
    isSelected ? styles.selected : !isAdd && styles.unselected,
    isAdd && styles.add,
  ];
  // As aria props, which the app and the web build both read.
  const a11y = isGrouped
    ? {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
        'aria-hidden': true,
      }
    : {
        accessibilityRole,
        accessibilityLabel: label,
        'aria-selected': accessibilityRole === 'tab' ? isSelected : undefined,
        'aria-expanded': isExpanded,
      };
  const content = isAdd ? (
    <Icon name="add" size={sizes.menuIcon} color={colors.text.secondary} />
  ) : (
    <>
      {mark}
      {!isRound && (
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      )}
      {hasCaret && <Icon name="chevron-down" size={sizes.menuIcon} color={colors.text.secondary} />}
    </>
  );

  return (
    <Animated.View layout={reflow} style={style}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          // With the frame's height and the bar's gaps, a 44 pt pitch.
          hitSlop={space.xs}
          {...a11y}
          style={({ pressed }) => [frame, pressed && press.flat]}
        >
          {content}
        </Pressable>
      ) : (
        <View {...a11y} style={frame}>
          {content}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  round: {
    width: ROUND,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  // See-through, as a tag: a shade darker than what it sits on.
  unselected: {
    backgroundColor: colors.background.fill,
  },
  selected: {
    backgroundColor: colors.background.surface,
    ...shadows.raised,
  },
  add: {
    borderColor: colors.border.dashed,
    borderStyle: 'dashed',
  },
  label: {
    ...textStyles.subheadline,
    color: colors.text.primary,
    flexShrink: 1,
  },
});
