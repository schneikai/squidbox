import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ellipse, G, Path } from 'react-native-svg';

import parts from './octopusParts.json';
import { pathOf } from './octopusPath';

import { motion } from '@/styles/designTokens';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const { colors } = parts;
const HEAD = polygonPath(parts.head);
const MOUTH = polygonPath(parts.mouth);
const MOUTH_LIGHT = parts.mouthLight.map(polygonPath);
const MOUTH_IN = parts.mouthIn.map(polygonPath);

const PULSE = motion.pulse.duration;
const FIRST_BLINK_MS = 1.5 * PULSE;
const BLINK_GAP_MS = { min: 3 * PULSE, max: 6 * PULSE }; // a slightly random rhythm doesn't feel mechanical
const BLINK = { duration: motion.duration.fast, easing: motion.pulse.easing };

// The head with its face, drawn over the arms' roots. The eyes blink unless `still`.
export default function OctopusFace({ still }) {
  const openness = useSharedValue(1);

  useEffect(() => {
    if (still) return undefined;
    let timer;
    function blink() {
      openness.value = withSequence(withTiming(0.1, BLINK), withTiming(1, BLINK));
      timer = setTimeout(blink, BLINK_GAP_MS.min + Math.random() * (BLINK_GAP_MS.max - BLINK_GAP_MS.min));
    }
    timer = setTimeout(blink, FIRST_BLINK_MS);
    return () => clearTimeout(timer);
  }, [still, openness]);

  return (
    <G>
      <Path d={HEAD} fill={colors.head} />
      {parts.eyes.map((eye, i) => (
        <Eye key={i} eye={eye} openness={openness} />
      ))}
      <Path d={MOUTH} fill={colors.mouth} />
      {MOUTH_LIGHT.map((d, i) => (
        <Path key={i} d={d} fill={colors.mouthLight} />
      ))}
      {MOUTH_IN.map((d, i) => (
        <Path key={i} d={d} fill={colors.back} />
      ))}
    </G>
  );
}

function Eye({ eye, openness }) {
  const animatedProps = useAnimatedProps(() => ({ ry: eye.ry * openness.value }));
  return <AnimatedEllipse cx={eye.cx} cy={eye.cy} rx={eye.rx} animatedProps={animatedProps} fill={colors.eye} />;
}

function polygonPath(points) {
  return pathOf(
    points.flatMap(([x, y]) => [x, y]),
    points.map(([, , sharp]) => sharp),
  );
}
