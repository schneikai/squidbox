import { describe, it, expect } from 'vitest';

import parts from '../src/components/octopus/octopusParts.json';

// Octopus.jsx draws the traced arms by position (DRAWN), at module load: a trace with other arms
// would throw before any error boundary could catch it.
const point = (p: number[]) => expect(p).toEqual([expect.any(Number), expect.any(Number)]);
const polygon = (points: number[][]) => {
  expect(points.length).toBeGreaterThanOrEqual(3);
  for (const [x, y, sharp] of points) {
    point([x, y]);
    expect([0, 1]).toContain(sharp);
  }
};

describe('octopusParts.json (traceOctopus.py)', () => {
  const backs = parts.arms.filter((arm) => arm.back);
  const fronts = parts.arms.filter((arm) => !arm.back);

  it('has the 2 back and 5 front arms Octopus.jsx draws', () => {
    expect(backs).toHaveLength(2);
    expect(fronts).toHaveLength(5);
  });

  it('lists the front arms left to right', () => {
    const xs = fronts.map((arm) => arm.root[0]);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('gives every arm a root, a tip apart from it, an outline and its shading', () => {
    for (const arm of parts.arms) {
      point(arm.root);
      point(arm.tip);
      expect(arm.tip).not.toEqual(arm.root);
      polygon(arm.shape);
      arm.shades.forEach(polygon);
    }
  });
});
