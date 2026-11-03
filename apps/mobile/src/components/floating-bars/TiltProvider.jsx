import { useEffect, useMemo, useReducer } from 'react';
import { SensorType, useAnimatedReaction, useAnimatedSensor, useSharedValue } from 'react-native-reanimated';

import TiltContext from './TiltContext';

import useReduceMotion from '@/hooks/useReduceMotion';

// How far the phone turns (radians) for a full tilt: about 12°.
const FULL_TILT = 0.2;
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
      // The phone's turn as angles, so it reads the same at any angle it is held: side to side, and
      // toward and away from the user (gravity moves between y and z then, little along either).
      const roll = Math.atan2(reading.x, Math.hypot(reading.y, reading.z));
      const pitch = Math.atan2(-reading.z, -reading.y);
      const now = Date.now();
      const previous = rest.value ?? { roll, pitch, at: now };
      const follow = 1 - Math.exp(-(now - previous.at) / REST_FOLLOW_MS);
      const next = {
        roll: previous.roll + (roll - previous.roll) * follow,
        pitch: previous.pitch + (pitch - previous.pitch) * follow,
        at: now,
      };
      rest.value = next;
      x.value = Math.max(-1, Math.min(1, (roll - next.roll) / FULL_TILT));
      y.value = Math.max(-1, Math.min(1, (pitch - next.pitch) / FULL_TILT));
    },
  );

  const value = useMemo(() => ({ x, y }), [x, y]);

  return <TiltContext value={value}>{children}</TiltContext>;
}
