import { useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountButton from './AccountButton';
import FloatingPill from './FloatingPill';
import useSelectModeProgress from './useSelectModeProgress';

import Button from '@/components/Button';
import ScrollEdgeFade from '@/components/ScrollEdgeFade';
import { colors, layout, sizes, space, textStyles } from '@/styles/designTokens';

export type FloatingHeaderProps = {
  title: string;
  /** The screen's own scroll offset (useScrollY): the scroll edge shows once content goes under the header. */
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
  // The large title stays as the list scrolls, over the scroll edge (ScrollEdgeFade): a tab has no room
  // for a centred small title between its buttons. Select mode animates once per change (selectProgress).
  const selectProgress = useSelectModeProgress(isSelectMode);
  const titleStyle = useAnimatedStyle(() => ({
    opacity: 1 - selectProgress.value,
    transform: [{ translateX: -24 * selectProgress.value }],
    pointerEvents: isSelectMode ? 'none' : 'auto',
  }));

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
    <>
      <ScrollEdgeFade headerBottom={insets.top + HEADER_ROW_HEIGHT} scrollY={scrollY} />
      <View style={[styles.container, { top: insets.top }]} pointerEvents="box-none">
        {/* Page title */}
        <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
          {title}
        </Animated.Text>

        {/* Normal mode: action pill + account */}
        <Animated.View style={[styles.rightGroup, normalStyle]}>
          <FloatingPill>
            {selection && (
              <Button icon="check-circle" onPress={selection.toggleSelectMode} accessibilityLabel="Select" />
            )}
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
    </>
  );
}

// The header's row under the safe area: a button with the container's padding (styles.container).
const HEADER_ROW_HEIGHT = sizes.iconButton + space.sm * 2;

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
