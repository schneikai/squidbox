import { useEffect, useMemo, useReducer } from 'react';
import { SensorType, useAnimatedReaction, useAnimatedSensor, useSharedValue } from 'react-native-reanimated';

import TiltContext from './TiltContext';

import useReduceMotion from '@/hooks/useReduceMotion';

// How far the phone turns (gravity along an axis, m/s²) for a full tilt: about 15°.
const FULL_TILT = 2.5;
// How long the rest pose takes to follow the phone (ms): the tilt is the turn from how it has been
// held lately, so floating UI settles back while the phone is held still at any angle.
const REST_FOLLOW_MS = 2500;

/**
 * The phone's tilt, read once for all floating UI (FloatingPill, the account button), which drift
 * and catch the light with it (useTiltStyles). Still with Reduce Motion on.
 */
export default function TiltProvider({ children }) {
  const reduceMotion = useReduceMotion();
  const gravity = useAnimatedSensor(SensorType.GRAVITY);
  // useAnimatedSensor starts the sensor after the first render, on a new shared value it hands out
  // on the next render: render once more so the reaction reads the live one.
  const [, rerender] = useReducer((count) => count + 1, 0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rest = useSharedValue(null);

  useEffect(rerender, []);

  useAnimatedReaction(
    () => gravity.sensor.value,
    (reading) => {
      if (reduceMotion) {
        x.value = 0;
        y.value = 0;
        return;
      }
      const now = Date.now();
      const previous = rest.value ?? { x: reading.x, y: reading.y, at: now };
      const follow = 1 - Math.exp(-(now - previous.at) / REST_FOLLOW_MS);
      const next = {
        x: previous.x + (reading.x - previous.x) * follow,
        y: previous.y + (reading.y - previous.y) * follow,
        at: now,
      };
      rest.value = next;
      x.value = Math.max(-1, Math.min(1, (reading.x - next.x) / FULL_TILT));
      y.value = Math.max(-1, Math.min(1, (reading.y - next.y) / FULL_TILT));
    },
    [reduceMotion, gravity.sensor],
  );

  const value = useMemo(() => ({ x, y }), [x, y]);

  return <TiltContext value={value}>{children}</TiltContext>;
}
