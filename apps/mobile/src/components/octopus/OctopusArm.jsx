import { useId } from 'react';
import Animated, { useAnimatedProps, useDerivedValue } from 'react-native-reanimated';
import { ClipPath, G, Path } from 'react-native-svg';

import parts from './octopusParts.json';
import { pathOf } from './octopusPath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { colors } = parts;
const FIXED = 0.25; // share of each arm, from the body, that never bends (as in traceOctopus.py)

// Bends rather than rotates: the part next to the body stays put and the rest turns around the root
// the more the further out it is, so the joints with the head stay exactly as drawn. Each point's
// offset from the root and its share of the bend are worked out once, here.
function bendable(points, [rx, ry], [tx, ty]) {
  const ux = tx - rx;
  const uy = ty - ry;
  const lengthSquared = ux * ux + uy * uy;
  return {
    rx,
    ry,
    offsets: points.flatMap(([x, y]) => [x - rx, y - ry]),
    weights: points.map(([x, y]) => {
      const along = ((x - rx) * ux + (y - ry) * uy) / lengthSquared;
      return Math.min(1, Math.max(0, (along - FIXED) / (1 - FIXED))) ** 1.6;
    }),
    sharp: points.map(([, , sharp]) => sharp),
  };
}

const BENDABLE = new Map(
  parts.arms.map((arm) => [
    arm,
    {
      outline: bendable(arm.shape, arm.root, arm.tip),
      shades: arm.shades.map((shade) => bendable(shade, arm.root, arm.tip)),
    },
  ]),
);

// One traced arm, bent by `angles.value[index]` (radians). Its shading is clipped to the bent
// outline, so their edges stay matched however far it bends.
export default function OctopusArm({ arm, angles, index }) {
  const clipId = useId();
  const { outline, shades } = BENDABLE.get(arm);
  const outlinePath = useDerivedValue(() => bentPath(outline, angles.value[index]));

  return (
    <G>
      <ClipPath id={clipId}>
        <OutlinePath path={outlinePath} />
      </ClipPath>
      <OutlinePath path={outlinePath} fill={arm.back ? colors.back : colors.head} />
      <G clipPath={`url(#${clipId})`}>
        {shades.map((shade, i) => (
          <ShadePath
            key={i}
            shade={shade}
            angles={angles}
            index={index}
            fill={arm.back ? colors.backShade : colors.shade}
          />
        ))}
      </G>
    </G>
  );
}

function OutlinePath({ path, fill }) {
  const animatedProps = useAnimatedProps(() => ({ d: path.value }));
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

function ShadePath({ shade, angles, index, fill }) {
  const animatedProps = useAnimatedProps(() => ({ d: bentPath(shade, angles.value[index]) }));
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

function bentPath({ rx, ry, offsets, weights, sharp }, angle) {
  'worklet';
  const xy = new Array(offsets.length);
  for (let i = 0; i < weights.length; i++) {
    const vx = offsets[2 * i];
    const vy = offsets[2 * i + 1];
    const a = angle * weights[i];
    if (a === 0) {
      xy[2 * i] = rx + vx;
      xy[2 * i + 1] = ry + vy;
      continue;
    }
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    xy[2 * i] = rx + vx * cos - vy * sin;
    xy[2 * i + 1] = ry + vx * sin + vy * cos;
  }
  return pathOf(xy, sharp);
}
