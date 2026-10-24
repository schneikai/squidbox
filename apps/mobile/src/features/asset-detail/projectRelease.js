// Where a release at v points per second comes to rest at iOS's normal deceleration (withDecay's
// default, 0.998 per ms): v × d / (1 − d) / 1000.
const DECELERATION = 0.998;
const PROJECTION = DECELERATION / (1 - DECELERATION) / 1000;

/**
 * Where something at `position` released at `velocity` (points per second, same sign as
 * `position`'s axis) would come to rest if it glided on, so a release can settle by where the
 * finger was sending it rather than by where it let go.
 */
export default function projectRelease(position, velocity) {
  'worklet';
  return position + PROJECTION * velocity;
}
