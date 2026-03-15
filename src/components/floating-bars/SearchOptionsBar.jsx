import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import FloatingPill from './FloatingPill';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

/**
 * Reusable bottom-left floating search + options bar.
 *
 * The parent owns `expandProgress` (a Reanimated shared value) so it can
 * animate sibling elements (e.g. a segment pill on the right) in sync.
 *
 * Props:
 *   expandProgress   – Reanimated SharedValue<number> (0 = collapsed, 1 = expanded)
 *   isSearchActive   – boolean
 *   searchText       – string
 *   onOpenSearch     – () => void
 *   onCloseSearch    – () => void
 *   onChangeSearch   – (text: string) => void
 *   onOpenOptions    – () => void
 *   hasActiveState   – boolean  (options button highlighted when sort/filter active)
 *   placeholder      – string   (default "Search…")
 *   bottom           – number
 *   left             – number
 *   maxWidth         – number
 */
export default function SearchOptionsBar({
  expandProgress,
  isSearchActive,
  searchText,
  onOpenSearch,
  onCloseSearch,
  onChangeSearch,
  onOpenOptions,
  hasActiveState = false,
  placeholder = 'Search…',
  bottom,
  left,
  maxWidth,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    expandProgress.value = withTiming(isSearchActive ? 1 : 0, { duration: 280 });
    if (isSearchActive) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isSearchActive]);

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expandProgress.value,
      [0, 1],
      [spacing.iconButtonSize * 2 + 20, maxWidth],
      Extrapolation.CLAMP,
    ),
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
    width: interpolate(expandProgress.value, [0, 0.4], [spacing.iconButtonSize, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    flex: expandProgress.value > 0.4 ? 1 : 0,
    overflow: 'hidden',
  }));

  return (
    <Animated.View style={[styles.container, { bottom, left }, containerStyle]}>
      <FloatingPill style={styles.pill}>
        {/* Search icon — always visible */}
        <Pressable
          onPress={onOpenSearch}
          style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
        >
          <Ionicons name="search" size={spacing.iconSize} color={colors.iconInactive} />
        </Pressable>

        {/* Collapsed: options button */}
        <Animated.View style={collapsedStyle}>
          <Pressable
            onPress={onOpenOptions}
            style={({ pressed }) => [
              actionButtonStyles.pillButton,
              hasActiveState && actionButtonStyles.buttonWarning,
              pressed && { backgroundColor: colors.pressedBg },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={spacing.iconSize}
              color={hasActiveState ? colors.accent : colors.iconInactive}
            />
          </Pressable>
        </Animated.View>

        {/* Expanded: text input + close + options */}
        <Animated.View style={[styles.expandedRow, expandedStyle]}>
          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={onChangeSearch}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            returnKeyType="search"
          />
          <Pressable
            onPress={onCloseSearch}
            style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
          >
            <Ionicons name="close" size={spacing.iconSize} color={colors.iconInactive} />
          </Pressable>
          <Pressable
            onPress={onOpenOptions}
            style={({ pressed }) => [
              actionButtonStyles.pillButton,
              hasActiveState && actionButtonStyles.buttonWarning,
              pressed && { backgroundColor: colors.pressedBg },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={spacing.iconSize}
              color={hasActiveState ? colors.accent : colors.iconInactive}
            />
          </Pressable>
        </Animated.View>
      </FloatingPill>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
  pill: {
    flex: 1,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
});
