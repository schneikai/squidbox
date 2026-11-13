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
  hasCaret?: boolean;
  variant?: 'add';
  onPress?: () => void;
  accessibilityRole?: 'tab' | 'button';
  isExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The round bubble's side: a chip's height.
const ROUND = sizes.smallButton + space.sm;

/**
 * One choice of a bar of bubbles (a post's channels): a grey disc holding only its `mark` (a logo),
 * or, `isSelected`, a white raised pill with the mark and its `label`, and with `hasCaret` a ⌄ (it
 * opens a menu). Without a mark it is a pill with its label, so it never shows empty. `variant="add"`
 * is the dashed + after them. `label` is always what VoiceOver reads; a bubble is a tab (selected or
 * not) unless `accessibilityRole` says button (the +); `isExpanded` tells, on one that opens a menu,
 * whether it is open. Its width change glides (`reflow`). Without `onPress` it is a plain view, so it
 * can sit where nothing is to be pressed. style is for layout only.
 */
export default function Bubble({
  label,
  mark,
  isSelected = false,
  hasCaret = false,
  variant,
  onPress,
  accessibilityRole = 'tab',
  isExpanded,
  style,
}: BubbleProps) {
  const isAdd = variant === 'add';
  const isRound = isAdd || (!!mark && !isSelected);
  const frame = [
    chipFrame,
    styles.bubble,
    isRound && styles.round,
    isSelected ? styles.selected : !isAdd && styles.unselected,
    isAdd && styles.add,
  ];
  // As aria props, which the app and the web build both read.
  const a11y = {
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
        <Text numberOfLines={1} style={[styles.label, isSelected && styles.selectedLabel]}>
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
  selectedLabel: {
    fontWeight: '600',
  },
});
