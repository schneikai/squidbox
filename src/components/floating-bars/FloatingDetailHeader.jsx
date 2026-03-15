import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

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
export default function FloatingDetailHeader({ title, subtitle, onBack, menuSlot, isSelectMode = false }) {
  const insets = useSafeAreaInsets();

  const leftStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelectMode ? 0 : 1, { duration: 200 }),
    transform: [{ translateX: withTiming(isSelectMode ? -24 : 0, { duration: 200 }) }],
    pointerEvents: isSelectMode ? 'none' : 'auto',
  }));

  return (
    <View
      style={[styles.container, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {/* Centre — rendered first so it sits below the pills in z-order;
          pointerEvents="none" ensures touches pass through to the pills above */}
      {(!!title || !!subtitle) && (
        <Animated.View style={[styles.infoArea, leftStyle]} pointerEvents="none">
          <FloatingPill style={styles.infoPill}>
            <View style={styles.infoContent}>
              {!!title && <Text style={styles.title} numberOfLines={2}>{title}</Text>}
              {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
            </View>
          </FloatingPill>
        </Animated.View>
      )}

      {/* Left — back chevron pill */}
      <Animated.View style={leftStyle}>
        <FloatingPill style={styles.backPill}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={spacing.iconSize} color={colors.text} />
          </Pressable>
        </FloatingPill>
      </Animated.View>

      {/* Right — menu / action pill */}
      {!!menuSlot && (
        <FloatingPill style={styles.menuPill}>
          {menuSlot}
        </FloatingPill>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.floatingBarSide,
    right: spacing.floatingBarSide,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },

  // ── Back pill ─────────────────────────────────────────────────────────────
  backPill: {
  },

  // ── Info pill ─────────────────────────────────────────────────────────────
  infoArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  infoPill: {
    maxWidth: '100%',
  },
  infoContent: {
    minHeight: spacing.iconButtonSize,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.barPaddingX,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Menu pill ─────────────────────────────────────────────────────────────
  menuPill: {
  },
});
