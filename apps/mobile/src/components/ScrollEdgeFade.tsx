import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import ScrollEdgeSurface from './ScrollEdgeSurface';

import { space } from '@/styles/designTokens';

// How far below the header's bottom the edge reaches as it fades out.
const FADE_ROOM = space.xxxl + space.lg;

export type ScrollEdgeFadeProps = {
  /** Where the header's buttons end, from the top of the screen or sheet. */
  headerBottom: number;
  /** The list's offset (useScrollY): the edge shows only once content scrolls under the header. */
  scrollY?: SharedValue<number>;
};

/**
 * The scroll edge under a floating header, as in iOS: what scrolls under the header stays visible
 * but blurs and pales towards the top, the blur fading out smoothly below the header, so it never
 * runs into the title. Touches pass through it. Every header draws one (ModalHeader, FloatingHeader,
 * FloatingDetailHeader), as a sibling just before its own row so it sits under it and over the list.
 * Given `scrollY`, it isn't drawn while the list is at its top.
 */
export default function ScrollEdgeFade({ headerBottom, scrollY }: ScrollEdgeFadeProps) {
  const [isMounted, setIsMounted] = useState(!scrollY);

  // Back to the JS thread only when the list leaves or reaches its top.
  useAnimatedReaction(
    () => !scrollY || scrollY.value > 0,
    (shown, previous) => {
      if (shown === (previous ?? !scrollY)) return;
      scheduleOnRN(setIsMounted, shown);
    },
  );

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: scrollY ? interpolate(scrollY.value, [0, space.lg], [0, 1], Extrapolation.CLAMP) : 1,
  }));

  if (!isMounted) return null;
  return (
    <Animated.View style={[styles.edge, { height: headerBottom + FADE_ROOM }, fadeStyle]} pointerEvents="none">
      <ScrollEdgeSurface />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Over the list, which screens render after their header; under the header, a sibling drawn after it at the same zIndex.
    zIndex: 100,
  },
});
