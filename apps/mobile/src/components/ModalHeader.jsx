import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, useSharedValue } from 'react-native-reanimated';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import { colors, layout, sizes, typography } from '@/styles/designTokens';

/**
 * Unified floating header for modal screens — matches the floating-bar visual language.
 *
 * The header is absolutely positioned so list/scroll content starts from y=0 and
 * scrolls underneath it. Content should set paddingTop: MODAL_HEADER_HEIGHT so the
 * first item is not hidden behind the header.
 *
 * Layout:
 *   [ FloatingPill: leading ]   [ centerTitle ]   [ FloatingPill: trailing ]
 *
 * Both side slots are automatically wrapped in FloatingPill (frosted glass).
 * The center title is absolutely positioned to stay truly centred and fades out
 * as the user scrolls (pass a reanimated SharedValue for this behaviour).
 *
 * Props:
 *   leading     ReactElement  — typically a close Button (icon="close")
 *   trailing    ReactElement  — e.g. icon buttons; auto-wrapped in FloatingPill
 *   title       string | ReactElement
 *   subtitle    string (optional) — a smaller grey line under a string title
 *   subtitleSize 'regular' (default) | 'small', for a subtitle that may be long (a model's name)
 *   scrollY     Reanimated SharedValue<number> (optional) — drives title fade-out on scroll
 */

export const MODAL_HEADER_HEIGHT = sizes.iconButton + layout.barBottom * 2 + 8;

export default function ModalHeader({ leading, trailing, title, subtitle, subtitleSize = 'regular', scrollY }) {
  // Stable fallback so animated style always has a value to read
  const fallback = useSharedValue(0);
  const anim = scrollY ?? fallback;

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 40], [1, 0], Extrapolation.CLAMP),
  }));

  const center =
    typeof title === 'string' ? (
      <Animated.View style={[styles.centerTitles, titleStyle]}>
        <Text style={styles.centerTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[styles.centerSubtitle, subtitleSize === 'small' && styles.centerSubtitleSmall]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </Animated.View>
    ) : (
      (title ?? null)
    );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left slot — wrapped in FloatingPill */}
      {leading != null && (
        <View style={styles.side} pointerEvents="box-none">
          <FloatingPill>{leading}</FloatingPill>
        </View>
      )}

      {/* Center — absolutely positioned so it doesn't affect side layout */}
      <View style={styles.centerAbsolute} pointerEvents="box-none">
        {center}
      </View>

      {/* Right slot — wrapped in FloatingPill */}
      {trailing != null && (
        <View style={[styles.side, styles.sideRight]} pointerEvents="box-none">
          <FloatingPill>{trailing}</FloatingPill>
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
    paddingHorizontal: layout.sideGutter,
    paddingVertical: layout.barBottom,
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
    paddingHorizontal: sizes.iconButton + layout.sideGutter,
  },
  centerTitles: {
    alignItems: 'center',
  },
  centerTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  centerSubtitle: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  centerSubtitleSmall: {
    fontSize: typography.caption2,
  },
});
