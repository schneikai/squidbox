import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, useSharedValue } from 'react-native-reanimated';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import { colors, scale, spacing } from '@/styles/designTokens';

/**
 * Unified floating header for modal screens — matches the floating-bar visual language.
 *
 * The header is absolutely positioned so list/scroll content starts from y=0 and
 * scrolls underneath it. Content should set paddingTop: MODAL_HEADER_HEIGHT so the
 * first item is not hidden behind the header.
 *
 * Layout:
 *   [ FloatingPill: leftSlot ]   [ centerTitle ]   [ FloatingPill: rightSlot ]
 *
 * Both side slots are automatically wrapped in FloatingPill (frosted glass).
 * The center title is absolutely positioned to stay truly centred and fades out
 * as the user scrolls (pass a reanimated SharedValue for this behaviour).
 *
 * Props:
 *   leftSlot    ReactElement  — typically <ModalCloseButton>
 *   rightSlot   ReactElement  — e.g. icon buttons; auto-wrapped in FloatingPill
 *   centerSlot  string | ReactElement
 *   centerStyle "plain" (default) | "pill"  — wraps string title in FloatingPill when "pill"
 *   scrollY     Reanimated SharedValue<number> (optional) — drives title fade-out on scroll
 */

export const MODAL_HEADER_HEIGHT = spacing.iconButtonSize + spacing.floatingBarBottom * 2 + 8;

export default function ModalHeader({ leftSlot, rightSlot, centerSlot, centerStyle = 'plain', scrollY }) {
  // Stable fallback so animated style always has a value to read
  const fallback = useSharedValue(0);
  const anim = scrollY ?? fallback;

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 40], [1, 0], Extrapolation.CLAMP),
  }));

  const center =
    typeof centerSlot === 'string' ? (
      <Animated.Text style={[styles.centerTitle, titleStyle]} numberOfLines={1}>
        {centerSlot}
      </Animated.Text>
    ) : (
      centerSlot ?? null
    );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left slot — wrapped in FloatingPill */}
      {leftSlot != null && (
        <View style={styles.side} pointerEvents="box-none">
          <FloatingPill>{leftSlot}</FloatingPill>
        </View>
      )}

      {/* Center — absolutely positioned so it doesn't affect side layout */}
      <View style={styles.centerAbsolute} pointerEvents="box-none">
        {centerStyle === 'pill' && center ? <FloatingPill>{center}</FloatingPill> : center}
      </View>

      {/* Right slot — wrapped in FloatingPill */}
      {rightSlot != null && (
        <View style={[styles.side, styles.sideRight]} pointerEvents="box-none">
          <FloatingPill>{rightSlot}</FloatingPill>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.floatingBarSide,
    paddingVertical: spacing.floatingBarBottom,
    zIndex: 100,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  sideRight: {
    marginLeft: 'auto',
  },
  centerAbsolute: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.iconButtonSize + spacing.floatingBarSide,
  },
  centerTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    color: colors.text,
  },
});
