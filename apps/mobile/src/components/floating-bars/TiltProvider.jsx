import { useMemo } from 'react';
import { SensorType, useAnimatedReaction, useAnimatedSensor, useSharedValue } from 'react-native-reanimated';

import TiltContext from './TiltContext';

import useReduceMotion from '@/hooks/useReduceMotion';

// How far the phone turns (gravity along an axis, m/s²) for a full tilt: about 15°.
const FULL_TILT = 2.5;
// How fast the rest pose follows the phone, per sensor reading: the tilt is the turn from how it has
// been held lately, so floating UI settles back while the phone is held still at any angle.
const REST_FOLLOW = 0.015;

/**
 * The phone's tilt, read once for all floating UI (FloatingPill, the account button), which drift
 * and catch the light with it (useTiltStyles). Still with Reduce Motion on.
 */
export default function TiltProvider({ children }) {
  const reduceMotion = useReduceMotion();
  const gravity = useAnimatedSensor(SensorType.GRAVITY);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rest = useSharedValue(null);

  useAnimatedReaction(
    () => gravity.sensor.value,
    (reading) => {
      if (reduceMotion) {
        x.value = 0;
        y.value = 0;
        return;
      }
      const previous = rest.value ?? reading;
      const next = {
        x: previous.x + (reading.x - previous.x) * REST_FOLLOW,
        y: previous.y + (reading.y - previous.y) * REST_FOLLOW,
      };
      rest.value = next;
      x.value = Math.max(-1, Math.min(1, (reading.x - next.x) / FULL_TILT));
      y.value = Math.max(-1, Math.min(1, (reading.y - next.y) / FULL_TILT));
    },
    [reduceMotion],
  );

  const value = useMemo(() => ({ x, y }), [x, y]);

  return <TiltContext value={value}>{children}</TiltContext>;
}
