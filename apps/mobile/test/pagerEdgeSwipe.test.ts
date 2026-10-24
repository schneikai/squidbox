import { describe, it, expect, vi } from 'vitest';

import projectRelease from '../src/features/asset-detail/projectRelease';
import shiftPager from '../src/features/asset-detail/shiftPager';
import snapPagerShift from '../src/features/asset-detail/snapPagerShift';
import springForRelease from '../src/features/asset-detail/springForRelease';

// The design tokens load React Native; the springs only need to be told apart.
vi.mock('@/styles/designTokens', () => ({ motion: { spring: { name: 'spring' }, settle: { name: 'settle' } } }));

const pageWidth = 400;
const neighbours = { pageWidth, hasPrevious: true, hasNext: true };

describe('pager edge swipe: shifting the pager (shiftPager)', () => {
  it('shifts towards the next page as far as the finger moves left', () => {
    expect(shiftPager({ shift: 0, delta: -30, ...neighbours })).toEqual({ shift: 30, leftover: 0 });
  });

  it('shifts towards the previous page as far as the finger moves right', () => {
    expect(shiftPager({ shift: 0, delta: 30, ...neighbours })).toEqual({ shift: -30, leftover: 0 });
  });

  it('stops at the current page when dragged back and leaves the rest to the image', () => {
    expect(shiftPager({ shift: 50, delta: 80, ...neighbours })).toEqual({ shift: 0, leftover: 30 });
    expect(shiftPager({ shift: -50, delta: -80, ...neighbours })).toEqual({ shift: 0, leftover: -30 });
  });

  it('shifts nothing towards a side without a page', () => {
    expect(shiftPager({ shift: 0, delta: -30, ...neighbours, hasNext: false })).toEqual({ shift: 0, leftover: -30 });
    expect(shiftPager({ shift: 0, delta: 30, ...neighbours, hasPrevious: false })).toEqual({ shift: 0, leftover: 30 });
  });

  it('never shifts past one page width', () => {
    expect(shiftPager({ shift: 380, delta: -50, ...neighbours })).toEqual({ shift: 400, leftover: -30 });
    expect(shiftPager({ shift: -380, delta: 50, ...neighbours })).toEqual({ shift: -400, leftover: 30 });
  });
});

describe('pager edge swipe: release projection (projectRelease)', () => {
  it('stays put without velocity', () => {
    expect(projectRelease(120, 0)).toBe(120);
  });

  it('carries a release on by its velocity at iOS deceleration', () => {
    expect(projectRelease(120, 1000)).toBeCloseTo(120 + (1000 * 0.998) / 0.002 / 1000);
  });
});

describe('pager edge swipe: release spring (springForRelease)', () => {
  it('bounces a flick in either direction', () => {
    expect(springForRelease(301)).toEqual({ name: 'spring' });
    expect(springForRelease(-1500)).toEqual({ name: 'spring' });
  });

  it('settles a slow release without overshoot', () => {
    expect(springForRelease(0)).toEqual({ name: 'settle' });
    expect(springForRelease(-300)).toEqual({ name: 'settle' });
  });
});

describe('pager edge swipe: where a release lands (snapPagerShift)', () => {
  it('moves on past half a page', () => {
    expect(snapPagerShift({ shift: 220, velocity: 0, ...neighbours })).toBe(1);
    expect(snapPagerShift({ shift: -220, velocity: 0, ...neighbours })).toBe(-1);
  });

  it('moves on with a flick from a short shift', () => {
    expect(snapPagerShift({ shift: 100, velocity: 1500, ...neighbours })).toBe(1);
    expect(snapPagerShift({ shift: -100, velocity: -1500, ...neighbours })).toBe(-1);
  });

  it('springs back from a short slow shift', () => {
    expect(snapPagerShift({ shift: 100, velocity: 0, ...neighbours })).toBe(0);
    expect(snapPagerShift({ shift: -100, velocity: 50, ...neighbours })).toBe(0);
  });

  it('never moves off the content', () => {
    expect(snapPagerShift({ shift: 300, velocity: 3000, ...neighbours, hasNext: false })).toBe(0);
    expect(snapPagerShift({ shift: -300, velocity: -3000, ...neighbours, hasPrevious: false })).toBe(0);
  });

  it('returns a flick back from a half-shown page to the current one, not across it', () => {
    expect(snapPagerShift({ shift: 300, velocity: -3000, ...neighbours })).toBe(0);
    expect(snapPagerShift({ shift: -300, velocity: 3000, ...neighbours })).toBe(0);
  });

  it('stays put when not shifted', () => {
    expect(snapPagerShift({ shift: 0, velocity: 3000, ...neighbours })).toBe(0);
  });
});
