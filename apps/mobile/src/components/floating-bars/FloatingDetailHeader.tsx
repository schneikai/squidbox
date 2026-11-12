import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';
import ToolbarTitle from './ToolbarTitle';
import useTitleMaxWidth from './useTitleMaxWidth';
import useTitleReveal, { type TitleReveal } from './useTitleReveal';

import Button from '@/components/Button';
import useSheetRoute from '@/hooks/useSheetRoute';
import { layout, motion, space } from '@/styles/designTokens';

export type FloatingDetailHeaderProps = {
  title?: string;
  subtitle?: string;
  onBack: () => void;
  menuSlot?: ReactNode;
  isSelectMode?: boolean;
  /** For a screen whose title is in the page: the list's offset, and the offset by which that title has
   * scrolled under the header. The title pill shows only from there. */
  titleReveal?: TitleReveal;
  children?: ReactNode;
};

/**
 * Three-part floating header for detail screens, mirroring the main screen
 * floating-bars layout:
 *
 *   [‹]          title / subtitle          [•••]
 *
 * Props:
 *   title        — primary label (e.g. date string)
 *   subtitle     — optional secondary line
 *   onBack       — called when the back chevron is pressed (× when the screen opens a sheet)
 *   menuSlot     — element(s) rendered inside the right FloatingPill
 *   isSelectMode — when true, back + info animate out to the left
 *   titleReveal  — the title shows only once the page's own title has scrolled away
 *   children     — centred under the row (a note about what the screen shows)
 */
export default function FloatingDetailHeader({
  title,
  subtitle,
  onBack,
  menuSlot,
  isSelectMode = false,
  titleReveal,
  children,
}: FloatingDetailHeaderProps) {
  const insets = useSafeAreaInsets();
  // A sheet's first screen has nothing in the sheet to go back to: it closes the sheet.
  const closesSheet = useSheetRoute()?.isFirstScreen ?? false;
  const { maxWidth, onRowLayout, onLeftLayout, onRightLayout } = useTitleMaxWidth();

  const leftStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 0 : 1, motion.move),
    transform: [{ translateX: withTiming(isSelectMode ? -24 : 0, motion.move) }],
  }));

  const titleArea = useTitleReveal(titleReveal, isSelectMode);

  return (
    <View
      // Inside a modal sheet the top safe-area inset is ~0, so insets.top + space.sm would leave the
      // pills hugging the sheet's top edge. Floor the offset at layout.barMargin so it matches
      // ModalHeader's top gap in sheets, while full screens (large insets.top) keep insets.top + space.sm.
      style={[styles.container, { top: Math.max(insets.top + space.sm, layout.barMargin) }]}
      pointerEvents="box-none"
    >
      <View style={styles.row} pointerEvents="box-none" onLayout={onRowLayout}>
        {/* Centre — rendered first so it sits below the pills in z-order;
          pointerEvents="none" ensures touches pass through to the pills above */}
        {(!!title || !!subtitle) && titleArea.isMounted && (
          <Animated.View style={[styles.infoArea, titleArea.style]} pointerEvents="none">
            <ToolbarTitle title={title} subtitle={subtitle} style={maxWidth !== undefined && { maxWidth }} />
          </Animated.View>
        )}

        {/* Left — back chevron pill */}
        <Animated.View style={leftStyle} pointerEvents={isSelectMode ? 'none' : 'auto'} onLayout={onLeftLayout}>
          <FloatingPill style={styles.backPill}>
            <Button
              icon={closesSheet ? 'close' : 'chevron-left'}
              onPress={onBack}
              accessibilityLabel={closesSheet ? 'Close' : 'Back'}
            />
          </FloatingPill>
        </Animated.View>

        {/* Right — menu / action pill */}
        {!!menuSlot && (
          <View onLayout={onRightLayout}>
            <FloatingPill style={styles.menuPill}>{menuSlot}</FloatingPill>
          </View>
        )}

        {/* Placeholder so rightWidth is measured even when there is no menuSlot */}
        {!menuSlot && <View pointerEvents="none" onLayout={onRightLayout} style={styles.emptyRightMeasure} />}
      </View>
      {children && (
        <View style={styles.below} pointerEvents="box-none">
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    gap: layout.barGap,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  below: {
    alignItems: 'center',
  },

  backPill: {},

  infoArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  menuPill: {},

  emptyRightMeasure: {
    width: 0,
    height: 0,
  },
});
