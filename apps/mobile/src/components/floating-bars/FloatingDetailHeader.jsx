import { useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import { colors, layout, lineHeights, motion, scale, sizes, typography } from '@/styles/designTokens';

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
 */

const SIDE_GAP = 12;

export default function FloatingDetailHeader({ title, subtitle, onBack, menuSlot, isSelectMode = false }) {
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
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Centre — rendered first so it sits below the pills in z-order;
          pointerEvents="none" ensures touches pass through to the pills above */}
      {(!!title || !!subtitle) && (
        <Animated.View style={[styles.infoArea, leftStyle]} pointerEvents="none">
          <FloatingPill style={[styles.infoPill, centerMaxWidth > 0 && { maxWidth: centerMaxWidth }]}>
            <View style={styles.infoContent}>
              {!!title && (
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                  {subtitle}
                </Text>
              )}
            </View>
          </FloatingPill>
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
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },

  backPill: {},

  // ── Info pill ─────────────────────────────────────────────────────────────
  infoArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  infoPill: {
    maxWidth: '100%',
    minWidth: 80,
    alignSelf: 'center',
  },
  infoContent: {
    minHeight: sizes.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 1,
    paddingHorizontal: layout.barPaddingX * 2,
  },
  title: {
    fontSize: typography.subheadline,
    lineHeight: scale(17),
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: typography.caption2,
    lineHeight: lineHeights.caption2,
    color: colors.text.secondary,
    textAlign: 'center',
    flexShrink: 1,
  },

  menuPill: {},

  emptyRightMeasure: {
    width: 0,
    height: 0,
  },
});
