import { use } from 'react';
import { useAnimatedStyle } from 'react-native-reanimated';

import TiltContext from './TiltContext';

import { tilt } from '@/styles/designTokens';

/**
 * The animated styles of a floating surface that tilts with the phone (TiltProvider): `lift`, for
 * its outer view, drifts it and slides its drop shadow (`shadow`: `'floating'` or `'subtle'`);
 * `rim`, for the view inside its clip, moves the light on its edge. At rest outside a TiltProvider.
 */
export default function useTiltStyles(shadow = 'floating') {
  const phone = use(TiltContext);
  const buildShadow = shadow === 'subtle' ? tilt.subtleShadow : tilt.floatingShadow;

  const lift = useAnimatedStyle(() => {
    const x = phone?.x.value ?? 0;
    const y = phone?.y.value ?? 0;
    return {
      transform: [{ translateX: x * tilt.parallax }, { translateY: y * tilt.parallax }],
      boxShadow: buildShadow(-x * tilt.shadowShift, -y * tilt.shadowShift),
    };
  });

  const rim = useAnimatedStyle(() => {
    const x = phone?.x.value ?? 0;
    const y = phone?.y.value ?? 0;
    return { boxShadow: tilt.litEdge(1 - x * tilt.light, 1 - y * tilt.light) };
  });

  return { lift, rim };
}
