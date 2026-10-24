import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedKeyboard,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import IconButton from '@/components/IconButton';
import IconMenuButton from '@/components/IconMenuButton';
import SearchTextInput from '@/components/SearchTextInput';
import { colors, glass, layout, motion, scale, sizes } from '@/styles/designTokens';

/**
 * Reusable bottom-left floating search + options bar, following the iOS search pattern:
 *   • Tapping search opens the field and brings up the keyboard (focus only ever follows a tap).
 *   • The clear button inside the field empties the query.
 *   • A separate round ✕ next to the field is Cancel: it leaves search, clears the query and hides
 *     the keyboard. The sort/filter button shows only while search is closed (as in Photos).
 *   • Scrolling the list hides the keyboard but keeps the query (lists use keyboardDismissMode).
 *   • Leaving the screen hides the keyboard; coming back keeps the query without reopening it.
 * Screens get these props as `searchBar` from `useListControls`.
 *
 * The parent owns `expandProgress` (a Reanimated shared value) so it can
 * animate sibling elements (e.g. a segment pill on the right) in sync.
 *
 * Props:
 *   expandProgress   – Reanimated SharedValue<number> (0 = collapsed, 1 = expanded)
 *   isSearchActive   – boolean
 *   searchText       – string
 *   onOpenSearch     – () => void
 *   onCloseSearch    – () => void  (Cancel: leave search and clear the query)
 *   onChangeSearch   – (text: string) => void
 *   optionsMenu      – the options button's menu (MenuOption rows)
 *   hasActiveState   – boolean  (options button highlighted while a filter is active)
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
  optionsMenu,
  hasActiveState = false,
  placeholder = 'Search…',
  bottom,
  left,
  maxWidth,
}) {
  const inputRef = useRef(null);
  const keyboard = useAnimatedKeyboard();
  const { bottom: bottomInset } = useSafeAreaInsets();

  useEffect(() => {
    expandProgress.value = withTiming(isSearchActive ? 1 : 0, motion.move);
  }, [isSearchActive]);

  // Never leave the input focused on a screen that isn't visible: iOS would bring the keyboard back
  // when the screen shows again.
  useFocusEffect(useCallback(() => () => inputRef.current?.blur(), []));

  function handleOpen() {
    onOpenSearch();
    inputRef.current?.focus();
  }

  function handleCancel() {
    inputRef.current?.blur();
    onCloseSearch();
  }

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(expandProgress.value, [0, 1], [COLLAPSED_WIDTH, maxWidth], Extrapolation.CLAMP),
    // keyboard.height on iOS includes the bottom safe area inset, which is already
    // baked into the `bottom` prop — subtract it to avoid double-counting.
    bottom: bottom + Math.max(0, keyboard.height.value - bottomInset),
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
    width: interpolate(expandProgress.value, [0, 0.4], [sizes.iconButton, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    flex: expandProgress.value > 0.4 ? 1 : 0,
    overflow: 'hidden',
  }));

  // The Cancel button grows in next to the field (like Photos), taking its width from the field.
  const cancelStyle = useAnimatedStyle(() => ({
    width: interpolate(expandProgress.value, [0.4, 1], [0, CANCEL_SLOT_WIDTH], Extrapolation.CLAMP),
    opacity: interpolate(expandProgress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.container, { left }, containerStyle]}>
      <FloatingPill style={styles.pill}>
        {/* Search icon — always visible */}
        <IconButton icon="search" onPress={handleOpen} color={colors.text.secondary} accessibilityLabel="Search" />

        {/* Collapsed: options button */}
        <Animated.View style={collapsedStyle}>
          <IconMenuButton
            icon="options"
            color={colors.text.secondary}
            isActive={hasActiveState}
            accessibilityLabel="Sort and filter"
          >
            {optionsMenu}
          </IconMenuButton>
        </Animated.View>

        {/* Expanded: the field, with the native clear button inside */}
        <Animated.View style={[styles.expandedRow, expandedStyle]}>
          <SearchTextInput
            ref={inputRef}
            value={searchText}
            onChangeText={onChangeSearch}
            placeholder={placeholder}
            style={styles.input}
            returnKeyType="search"
            clearButtonMode="always"
          />
        </Animated.View>
      </FloatingPill>

      {/* Cancel: a separate round button next to the field */}
      <Animated.View style={[styles.cancelSlot, cancelStyle]} pointerEvents={isSearchActive ? 'auto' : 'none'}>
        <FloatingPill style={styles.cancelPill}>
          <IconButton
            icon="close"
            onPress={handleCancel}
            color={colors.text.secondary}
            accessibilityLabel="Cancel search"
          />
        </FloatingPill>
      </Animated.View>
    </Animated.View>
  );
}

const PILL_GAP = 8;
// A pill's width around its buttons: the frame and the border on each side.
const PILL_CHROME = (layout.toolbarFrame + glass.borderWidth) * 2;
const COLLAPSED_WIDTH = sizes.iconButton * 2 + PILL_CHROME;
const CANCEL_PILL_WIDTH = sizes.iconButton + PILL_CHROME;
const CANCEL_SLOT_WIDTH = CANCEL_PILL_WIDTH + PILL_GAP;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flex: 1,
  },
  cancelSlot: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelPill: {
    width: CANCEL_PILL_WIDTH,
    flexShrink: 0,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  input: {
    flex: 1,
    lineHeight: scale(20),
    paddingLeft: scale(4),
    paddingRight: scale(12),
    paddingVertical: 0,
  },
});
