// iOS's scroll view constant: how much of a drag past the edge still moves the content.
const RESISTANCE = 0.55;

// The helpers come first: a worklet captures the worklets it calls when it is defined.

function rubberBand(distance, dimension) {
  'worklet';
  return (1 - 1 / ((distance * RESISTANCE) / dimension + 1)) * dimension;
}

// The band approaches `dimension` but never reaches it, so an offset at or past it is capped.
function unrubberBand(offset, dimension) {
  'worklet';
  const capped = Math.min(offset, dimension * 0.99);
  return ((1 / (1 - capped / dimension) - 1) * dimension) / RESISTANCE;
}

function band(value, min, max, dimension) {
  'worklet';
  if (value > max) return max + rubberBand(value - max, dimension);
  if (value < min) return min - rubberBand(min - value, dimension);
  return value;
}

function unband(value, min, max, dimension) {
  'worklet';
  if (value > max) return max + unrubberBand(value - max, dimension);
  if (value < min) return min - unrubberBand(min - value, dimension);
  return value;
}

/**
 * Moves `position` by `delta`, freely within [min, max] and rubber-banded beyond it, the way an iOS
 * scroll view resists past its edge. The band is undone first, so a drag that starts outside the
 * bounds (an animation still settling) continues along the same curve instead of jumping.
 */
export default function dragWithin({ position, delta, min, max, dimension }) {
  'worklet';
  return band(unband(position, min, max, dimension) + delta, min, max, dimension);
}
