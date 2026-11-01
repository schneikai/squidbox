import { useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';
import ToolbarTitle from './ToolbarTitle';

import Button from '@/components/Button';
import { layout, motion } from '@/styles/designTokens';

/**
 * Three-part floating header for detail screens, mirroring the main screen
 * floating-bars layout:
 *
 *   [‹]          title / subtitle          [•••]
 *
 * Props:
 *   title        — primary label (e.g. date string)
 *   subtitle     — optional secondary line
 *   onBack       — called when the back chevron is pressed
 *   menuSlot     — element(s) rendered inside the right FloatingPill
 *   isSelectMode — when true, back + info animate out to the left
 *   children     — centred under the row (a note about what the screen shows)
 */

const SIDE_GAP = 12;

export default function FloatingDetailHeader({ title, subtitle, onBack, menuSlot, isSelectMode = false, children }) {
  const insets = useSafeAreaInsets();

  const [containerWidth, setContainerWidth] = useState(0);
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);

  const centerMaxWidth = useMemo(() => {
    if (!containerWidth) return 0;
    const sideClearance = Math.max(leftWidth, rightWidth) + SIDE_GAP;
    return Math.max(0, containerWidth - sideClearance * 2);
  }, [containerWidth, leftWidth, rightWidth]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 0 : 1, motion.move),
    transform: [{ translateX: withTiming(isSelectMode ? -24 : 0, motion.move) }],
  }));

  return (
    <View
      // Inside a modal sheet the top safe-area inset is ~0, so insets.top + 8 would leave the pills
      // hugging the sheet's top edge. Floor the offset at layout.barBottom so it matches ModalHeader's
      // top gap in sheets, while full screens (large insets.top) keep insets.top + 8 unchanged.
      style={[styles.container, { top: Math.max(insets.top + 8, layout.barBottom) }]}
      pointerEvents="box-none"
    >
      <View style={styles.row} pointerEvents="box-none" onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        {/* Centre — rendered first so it sits below the pills in z-order;
          pointerEvents="none" ensures touches pass through to the pills above */}
        {(!!title || !!subtitle) && (
          <Animated.View style={[styles.infoArea, leftStyle]} pointerEvents="none">
            <ToolbarTitle
              title={title}
              subtitle={subtitle}
              style={centerMaxWidth > 0 && { maxWidth: centerMaxWidth }}
            />
          </Animated.View>
        )}

        {/* Left — back chevron pill */}
        <Animated.View
          style={leftStyle}
          pointerEvents={isSelectMode ? 'none' : 'auto'}
          onLayout={(e) => setLeftWidth(e.nativeEvent.layout.width)}
        >
          <FloatingPill style={styles.backPill}>
            <Button icon="chevron-left" onPress={onBack} accessibilityLabel="Back" />
          </FloatingPill>
        </Animated.View>

        {/* Right — menu / action pill */}
        {!!menuSlot && (
          <View onLayout={(e) => setRightWidth(e.nativeEvent.layout.width)}>
            <FloatingPill style={styles.menuPill}>{menuSlot}</FloatingPill>
          </View>
        )}

        {/* Placeholder so rightWidth is measured even when there is no menuSlot */}
        {!menuSlot && (
          <View
            pointerEvents="none"
            onLayout={(e) => setRightWidth(e.nativeEvent.layout.width)}
            style={styles.emptyRightMeasure}
          />
        )}
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
    gap: layout.barBottom,
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
