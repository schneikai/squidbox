import { memo, type ReactNode, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  type FrameInfo,
  type SharedValue,
  interpolate,
  makeMutable,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import OctopusArm from './OctopusArm';
import OctopusBubble, { BUBBLE_POPPED_MS } from './OctopusBubble';
import OctopusFace from './OctopusFace';
import parts from './octopusParts.json';

import useReduceMotion from '@/hooks/useReduceMotion';
import { motion } from '@/styles/designTokens';

const [WIDTH, HEIGHT] = parts.size;
const PULSE = motion.pulse.duration;
const FAST = motion.duration.fast;
// eslint-disable-next-line no-restricted-syntax -- room in the drawing's viewBox, not layout
const PAD = { side: 40, top: 120 }; // room for bent arms and for the bubbles popping above the head
const VIEW_BOX = `${-PAD.side} ${-PAD.top} ${WIDTH + 2 * PAD.side} ${HEIGHT + PAD.top + PAD.side}`;

// Idle: the body floats up and down; each arm sways with its own amplitude and phase, one sway being
// two halves of a breath each way.
const SWAY_MS = 4 * PULSE;
const FLOAT = 6;
const deg = (degrees: number) => (degrees * Math.PI) / 180;
const backs = parts.arms.filter((arm) => arm.back);
const fronts = parts.arms.filter((arm) => !arm.back); // left to right
// Drawn back to front: the back arms, then the outer front arms behind the inner ones.
const DRAWN = [
  { arm: backs[0], amp: 7, phase: 0 },
  { arm: backs[1], amp: 7, phase: 2.1 },
  { arm: fronts[0], amp: 6, phase: 0.4 },
  { arm: fronts[4], amp: 6, phase: 2.3 },
  { arm: fronts[1], amp: 5, phase: 1.7 },
  { arm: fronts[3], amp: 5, phase: 0.9 },
  { arm: fronts[2], amp: 4, phase: 2.9 },
];

// A tap sends a wave through the arms, left to right: each lifts its tip once, a little after the last.
const WAVE = { amp: deg(16), step: FAST / 2, length: 3 * FAST };
const WAVE_MS = WAVE.length + (DRAWN.length - 1) * WAVE.step;
const leftToRight = [...DRAWN].sort((a, b) => a.arm.root[0] - b.arm.root[0]);
const ARM_MOTION = DRAWN.map(({ arm, amp, phase }) => ({
  amp: deg(amp),
  phase,
  waveDelay: leftToRight.findIndex((drawn) => drawn.arm === arm) * WAVE.step,
  lift: arm.tip[0] < arm.root[0] ? 1 : -1, // turning clockwise lifts an arm that points left
}));

// ...the head squeezes from its bottom middle, squashed for a moment, then springs back...
const SQUEEZE_MS = 4 * FAST;
const SQUEEZE = { at: [0, 0.2, 0.5, 0.75, 1], x: [1, 1.07, 0.97, 1.01, 1], y: [1, 0.9, 1.04, 0.99, 1] };
// Whole percents: React Native's transformOrigin parser rejects decimals (web accepts them).
const SQUEEZE_ORIGIN = `${Math.round((parts.headBase[0] / WIDTH) * 100)}% ${Math.round((parts.headBase[1] / HEIGHT) * 100)}%`;

// ...and it blows three bubbles as the squeeze peaks; each smaller one rises a little slower, so
// they spread out on the way up and pop one by one.
const BUBBLE_START = 0.8 * FAST;
// eslint-disable-next-line no-restricted-syntax -- a time between bubbles, not a spacing
const BUBBLE_GAP = 0.2 * PULSE;
const BUBBLES = [
  { radius: 22, delay: BUBBLE_START, drift: 22, duration: 2.2 * PULSE },
  { radius: 15, delay: BUBBLE_START + BUBBLE_GAP, drift: -18, duration: 3.2 * PULSE },
  { radius: 10, delay: BUBBLE_START + 2 * BUBBLE_GAP, drift: 14, duration: 4.2 * PULSE },
];

// The wave (with the squeeze) and the bubbles each have a clock since the tap that blew them, which
// runs only while they play, so between taps none of it is worked out. The bubbles outlast the wave:
// a tap once the wave is over waves again, but blows new bubbles only once the last ones are gone.
const WAVE_END = Math.max(WAVE_MS, SQUEEZE_MS);
const BUBBLES_END = Math.max(...BUBBLES.map(({ delay, duration }) => delay + duration + BUBBLE_POPPED_MS));
const STOPPED = -1;

// The splash's idle clock, for the octopuses with `sharedClock` (SplashStage's): the frame timestamp
// of the first frame one of them drew. The boot screen's octopus fading out over the first-sync
// screen's then shows the same pose; the first eases in from the drawn pose, as the splash shows it,
// and a later one joins mid-sway.
const CLOCK_ORIGIN = makeMutable(STOPPED);

// Bending the arms rebuilds their paths, so at rest they bend anew only at about 30 Hz (every other
// frame at 60 Hz, every fourth at 120 Hz; a little under 1/30 s so frame jitter never skips one more),
// and on every frame while a tap plays.
const IDLE_BEND_MS = 30;

export type OctopusProps = { size: number; sharedClock?: boolean };

// The splash octopus, alive: it floats, sways its arms and blinks, and a tap makes it wave and blow
// bubbles. `size` is its width; the arms and bubbles reach out of that box. With Reduce Motion it
// stays still, exactly as drawn in assets/splash.png. Each octopus eases in from the drawn pose on
// its own clock, unless `sharedClock` puts it on the splash's (CLOCK_ORIGIN).
function Octopus({ size, sharedClock = false }: OctopusProps) {
  const reduceMotion = useReduceMotion();
  const time = useSharedValue(0);
  const bendTime = useSharedValue(0); // `time`, as of the arms' last bend
  const sinceWave = useSharedValue(STOPPED);
  const sinceBubbles = useSharedValue(STOPPED);
  // Stable, and adding up frame times (a re-registered frame callback starts its own clock from 0),
  // except a `sharedClock` octopus's idle time, read off the splash's clock.
  const advance = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      const elapsed = frame.timeSincePreviousFrame ?? 0;
      if (sharedClock) {
        if (CLOCK_ORIGIN.value === STOPPED) CLOCK_ORIGIN.value = frame.timestamp;
        time.value = frame.timestamp - CLOCK_ORIGIN.value;
      } else time.value += elapsed;
      const waving = tick(sinceWave, elapsed, WAVE_END);
      const blowing = tick(sinceBubbles, elapsed, BUBBLES_END);
      if (waving || blowing || time.value - bendTime.value >= IDLE_BEND_MS) bendTime.value = time.value;
    },
    [sharedClock, time, bendTime, sinceWave, sinceBubbles],
  );
  const frames = useFrameCallback(advance, false);

  // Moves unless Reduce Motion is on, and turning it on puts the octopus back as drawn; turning it
  // off again starts it over (a `sharedClock` one rejoins the splash's clock).
  useEffect(() => {
    frames.setActive(!reduceMotion);
    if (!reduceMotion) return;
    time.value = 0;
    bendTime.value = 0;
    sinceWave.value = STOPPED;
    sinceBubbles.value = STOPPED;
  }, [reduceMotion, frames, time, bendTime, sinceWave, sinceBubbles]);

  const unit = size / WIDTH;
  const angles = useDerivedValue(() => {
    const t = bendTime.value;
    const idle = idleAt(t);
    const since = sinceWave.value;
    return ARM_MOTION.map(({ amp, phase, waveDelay, lift }) => {
      const sway = idle * amp * Math.sin((2 * Math.PI * t) / SWAY_MS + phase);
      if (since === STOPPED) return sway;
      const wave = (since - waveDelay) / WAVE.length;
      return wave > 0 && wave < 1 ? sway + lift * WAVE.amp * Math.sin(Math.PI * wave) : sway;
    });
  });
  const floatStyle = useAnimatedStyle(() => {
    const t = time.value;
    return { transform: [{ translateY: unit * FLOAT * idleAt(t) * Math.cos((Math.PI * t) / SWAY_MS) }] };
  });
  const squeezeStyle = useAnimatedStyle(() => {
    const t = sinceWave.value / SQUEEZE_MS;
    const p = t > 0 && t < 1 ? motion.enter.easing(t) : 0;
    return {
      transform: [{ scaleX: interpolate(p, SQUEEZE.at, SQUEEZE.x) }, { scaleY: interpolate(p, SQUEEZE.at, SQUEEZE.y) }],
    };
  });

  function handlePress() {
    if (sinceWave.value !== STOPPED) return;
    sinceWave.value = 0;
    if (sinceBubbles.value === STOPPED) sinceBubbles.value = 0;
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={reduceMotion}
      accessibilityRole="image"
      accessibilityLabel="Squidbox octopus"
      style={{ width: size, height: unit * HEIGHT }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        <Layer unit={unit}>
          {DRAWN.map(({ arm }, i) => (
            <OctopusArm key={i} arm={arm} angles={angles} index={i} />
          ))}
        </Layer>
        <Animated.View style={[StyleSheet.absoluteFill, styles.face, squeezeStyle]}>
          <Layer unit={unit}>
            <OctopusFace still={reduceMotion} />
          </Layer>
        </Animated.View>
        <Layer unit={unit}>
          {BUBBLES.map((bubble, i) => (
            <OctopusBubble key={i} {...bubble} since={sinceBubbles} />
          ))}
        </Layer>
      </Animated.View>
    </Pressable>
  );
}

export default memo(Octopus);

// An SVG in the traced image's pixels, placed over the octopus's box with room around it.
type LayerProps = { unit: number; children?: ReactNode };
function Layer({ unit, children }: LayerProps) {
  return (
    <Svg
      viewBox={VIEW_BOX}
      width={unit * (WIDTH + 2 * PAD.side)}
      height={unit * (HEIGHT + PAD.top + PAD.side)}
      style={{ position: 'absolute', left: -unit * PAD.side, top: -unit * PAD.top }}
    >
      {children}
    </Svg>
  );
}

// Moves a tap's clock on by a frame, up to `end`, where it stops. Whether it was running.
function tick(clock: SharedValue<number>, elapsed: number, end: number) {
  'worklet';
  if (clock.value === STOPPED) return false;
  const since = clock.value + elapsed;
  clock.value = since < end ? since : STOPPED;
  return true;
}

// How much of the idle motion plays: it eases in over the first half breath, so the octopus starts
// exactly as drawn on the splash screen.
function idleAt(time: number) {
  'worklet';
  return time >= PULSE ? 1 : motion.pulse.easing(time / PULSE);
}

const styles = StyleSheet.create({
  face: { transformOrigin: SQUEEZE_ORIGIN },
});
