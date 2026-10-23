import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { colors, layout, radii, sizes } from '@/styles/designTokens';

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;

/**
 * A playback position bar. `progress` (a shared value, 0–1) fills it; a finger down on it, held or
 * dragged, sets it and reports the new position: `onScrubStart()`, `onScrub(fraction)` for each
 * move, `onScrubEnd()`. The touch area is a full tap target tall, around the thin track.
 */
export default function VideoScrubber({ progress, onScrubStart, onScrub, onScrubEnd }) {
  const width = useSharedValue(0);

  const gesture = useMemo(() => {
    const scrubTo = (x) => {
      'worklet';
      progress.value = width.value > 0 ? clamp(x / width.value, 0, 1) : 0;
      runOnJS(onScrub)(progress.value);
    };
    return Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        runOnJS(onScrubStart)();
        scrubTo(event.x);
      })
      .onUpdate((event) => scrubTo(event.x))
      .onFinalize(() => runOnJS(onScrubEnd)());
  }, [progress, width, onScrubStart, onScrub, onScrubEnd]);

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width.value - THUMB_SIZE / 2 }],
  }));

  function handleLayout(event) {
    width.value = event.nativeEvent.layout.width;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.touchArea} onLayout={handleLayout}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    flex: 1,
    // The thumb overhangs the track ends by half its size; keep a gap to the times beside it.
    marginHorizontal: layout.barPaddingX + THUMB_SIZE / 2,
    height: sizes.iconButton,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.light,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent.base,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (sizes.iconButton - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.base,
  },
});
