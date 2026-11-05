import { useId } from 'react';
import Animated, { type DerivedValue, useAnimatedProps, useDerivedValue } from 'react-native-reanimated';
import { ClipPath, G, Path } from 'react-native-svg';

import parts from './octopusParts.json';
import { pathOf } from './octopusPath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { colors } = parts;
const FIXED = 0.25; // share of each arm, from the body, that never bends (as in traceOctopus.py)

// Bends rather than rotates: the part next to the body stays put and the rest turns around the root
// the more the further out it is, so the joints with the head stay exactly as drawn. Each point's
// offset from the root and its share of the bend are worked out once, here.
function bendable(points: number[][], [rx, ry]: number[], [tx, ty]: number[]) {
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

type Bendable = ReturnType<typeof bendable>;
type Arm = (typeof parts.arms)[number];

const BENDABLE = new Map(
  parts.arms.map((arm) => [
    arm,
    {
      outline: bendable(arm.shape, arm.root, arm.tip),
      shades: arm.shades.map((shade) => bendable(shade, arm.root, arm.tip)),
    },
  ]),
);

export type OctopusArmProps = { arm: Arm; angles: DerivedValue<number[]>; index: number };

// One traced arm, bent by `angles.value[index]` (radians). Its shading is clipped to the bent
// outline, so their edges stay matched however far it bends.
export default function OctopusArm({ arm, angles, index }: OctopusArmProps) {
  const clipId = useId();
  const bent = BENDABLE.get(arm);
  if (!bent) throw new Error("OctopusArm: not one of octopusParts.json's arms");
  const { outline, shades } = bent;
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

type OutlinePathProps = { path: DerivedValue<string>; fill?: string };
function OutlinePath({ path, fill }: OutlinePathProps) {
  const animatedProps = useAnimatedProps(() => ({ d: path.value }));
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

type ShadePathProps = { shade: Bendable; angles: DerivedValue<number[]>; index: number; fill: string };
function ShadePath({ shade, angles, index, fill }: ShadePathProps) {
  const animatedProps = useAnimatedProps(() => ({ d: bentPath(shade, angles.value[index]) }));
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

function bentPath({ rx, ry, offsets, weights, sharp }: Bendable, angle: number) {
  'worklet';
  const xy = new Array<number>(offsets.length);
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
