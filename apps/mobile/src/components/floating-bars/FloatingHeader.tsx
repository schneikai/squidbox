import { useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountButton from './AccountButton';
import FloatingPill from './FloatingPill';
import ToolbarTitle from './ToolbarTitle';
import useSelectModeProgress from './useSelectModeProgress';
import useTitleReveal from './useTitleReveal';

import Button from '@/components/Button';
import { colors, layout, space, textStyles } from '@/styles/designTokens';

// The scroll offset (pt) by which the large title is gone and the small one starts to show.
const COMPACT_FROM = 40;

export type FloatingHeaderProps = {
  title: string;
  /** The screen's own scroll offset (useScrollY): the title fades as it scrolls. */
  scrollY: SharedValue<number>;
  onAdd: () => void;
} & (
  | {
      /** The screen's select mode (useToggleSelectAssetsAction's selection). */
      selection: { isSelectMode: boolean; toggleSelectMode: () => void };
      /** What the pill shows in select mode: the screen's selection actions. */
      selectionSlot: ReactNode;
    }
  | { selection?: undefined; selectionSlot?: undefined }
);

// The main screens' header. `title` is the screen's title. A screen with select mode passes its `selection`
// and, as `selectionSlot`, the actions its pill shows in select mode.
export default function FloatingHeader({ title, scrollY, onAdd, selection, selectionSlot }: FloatingHeaderProps) {
  const insets = useSafeAreaInsets();
  // Typed routes are off, so the tab's name goes untyped.
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isSelectMode = selection?.isSelectMode ?? false;

  // ── Animated styles (must be called before any conditional return) ─────────
  // As the list scrolls, the large title gives way to a small one in a pill (ToolbarTitle), so the tab
  // keeps its name on screen over the content (HIG, Toolbars: a large title turns into a standard one).
  // The scroll parts follow the finger; select mode animates once per change (selectProgress).
  const selectProgress = useSelectModeProgress(isSelectMode);
  const titleStyle = useAnimatedStyle(() => {
    const scrollOpacity = interpolate(scrollY.value, [0, COMPACT_FROM], [1, 0], Extrapolation.CLAMP);
    const scrollY_ = interpolate(scrollY.value, [0, COMPACT_FROM], [0, -8], Extrapolation.CLAMP);
    return {
      opacity: scrollOpacity * (1 - selectProgress.value),
      transform: [{ translateY: scrollY_ }, { translateX: -24 * selectProgress.value }],
      pointerEvents: isSelectMode ? 'none' : 'auto',
    };
  });

  const compactTitle = useTitleReveal({ scrollY, from: COMPACT_FROM }, selectProgress);

  // Normal controls (action pill + account) fade out in select mode
  const normalStyle = useAnimatedStyle(() => ({
    opacity: 1 - selectProgress.value,
    transform: [{ translateX: 30 * selectProgress.value }],
    pointerEvents: isSelectMode ? 'none' : 'auto',
  }));

  // Select pill slides in from right in select mode
  const selectPillStyle = useAnimatedStyle(() => ({
    opacity: selectProgress.value,
    transform: [{ translateX: 30 * (1 - selectProgress.value) }],
    pointerEvents: isSelectMode ? 'auto' : 'none',
  }));

  // To the Settings tab as it was left (`router.navigate('/settings')` would pop to its first screen).
  function handleSettings() {
    navigation.navigate('settings');
  }

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
      {/* Page title */}
      <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
        {title}
      </Animated.Text>

      {/* Small title, once the list is scrolled */}
      {compactTitle.isMounted && (
        <Animated.View
          style={[styles.compactTitle, compactTitle.style]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <ToolbarTitle title={title} />
        </Animated.View>
      )}

      {/* Normal mode: action pill + account */}
      <Animated.View style={[styles.rightGroup, normalStyle]}>
        <FloatingPill>
          {selection && <Button icon="check-circle" onPress={selection.toggleSelectMode} accessibilityLabel="Select" />}
          <Button variant="primary" icon="add" onPress={onAdd} accessibilityLabel="Add" />
        </FloatingPill>
        <AccountButton onPress={handleSettings} />
      </Animated.View>

      {/* Select mode pill */}
      {selection && (
        <Animated.View style={[styles.pillWrapper, selectPillStyle]}>
          <FloatingPill>{selectionSlot}</FloatingPill>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    zIndex: 100,
  },
  title: {
    ...textStyles.title1,
    color: colors.text.primary,
    flex: 1,
  },
  compactTitle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pillWrapper: {
    position: 'absolute',
    right: 0,
  },
});
