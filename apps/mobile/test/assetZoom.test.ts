import { describe, it, expect } from 'vitest';

import dragWithin from '../src/features/asset-detail/dragWithin';
import getPanBounds from '../src/features/asset-detail/getPanBounds';
import zoomAround from '../src/features/asset-detail/zoomAround';

// Screen position of a content point (measured from the view's center, at 1×) under a transform.
const onScreen = (point: number, translation: number, scale: number) => translation + scale * point;

describe('asset zoom: focal point (zoomAround)', () => {
  it('keeps the point under the fingers in place while pinching', () => {
    const translation = zoomAround({ translation: 0, from: 100, to: 100, ratio: 2 });
    expect(translation).toBe(-100);
    expect(onScreen(100, translation, 2)).toBe(100);
  });

  it('holds the same content point across successive pinch events', () => {
    // At 2×, translation -100: content point 100 sits at 100. Zoom on to 3× around it.
    const translation = zoomAround({ translation: -100, from: 100, to: 100, ratio: 3 / 2 });
    expect(onScreen(100, translation, 3)).toBe(100);
  });

  it('brings a double-tapped point to the center', () => {
    const translation = zoomAround({ translation: 0, from: -120, to: 0, ratio: 2.5 });
    expect(onScreen(-120, translation, 2.5)).toBe(0);
  });
});

describe('asset zoom: pan bounds (getPanBounds)', () => {
  const view = { width: 400, height: 800 };

  it('has nothing to pan at 1×', () => {
    expect(getPanBounds({ scale: 1, ...view, aspectRatio: 0.5 })).toEqual({ x: 0, y: 0 });
    expect(getPanBounds({ scale: 1, ...view, aspectRatio: 1.5 })).toEqual({ x: 0, y: 0 });
  });

  it('lets an image that fills the view pan by half its overflow on both axes', () => {
    expect(getPanBounds({ scale: 2, ...view, aspectRatio: 0.5 })).toEqual({ x: 200, y: 400 });
  });

  it('keeps a letterboxed landscape image centered vertically until it overflows the height', () => {
    // 3:2 in a 400 × 800 view is fitted to 400 × 266.7.
    expect(getPanBounds({ scale: 2, ...view, aspectRatio: 1.5 })).toEqual({ x: 200, y: 0 });
    const tall = getPanBounds({ scale: 4, ...view, aspectRatio: 1.5 });
    expect(tall.x).toBe(600);
    expect(tall.y).toBeCloseTo((266.667 * 4 - 800) / 2, 1);
  });

  it('fits a tall image to the height, with its sides inside the view', () => {
    // 1:4 in a 400 × 800 view is fitted to 200 × 800.
    expect(getPanBounds({ scale: 2, ...view, aspectRatio: 0.25 })).toEqual({ x: 0, y: 400 });
  });

  it('takes an image without a usable aspect ratio to fill the view', () => {
    for (const aspectRatio of [NaN, 0, Infinity, -1, undefined]) {
      expect(getPanBounds({ scale: 2, ...view, aspectRatio })).toEqual({ x: 200, y: 400 });
    }
  });

  it('has nothing to pan in a view not measured yet', () => {
    for (const size of [
      { width: 0, height: 0 },
      { width: 400, height: 0 },
      { width: 0, height: 800 },
      { width: NaN, height: 800 },
    ]) {
      expect(getPanBounds({ scale: 2, ...size, aspectRatio: 0.5 })).toEqual({ x: 0, y: 0 });
      expect(getPanBounds({ scale: 2, ...size, aspectRatio: NaN })).toEqual({ x: 0, y: 0 });
    }
  });
});

describe('asset zoom: rubber band (dragWithin)', () => {
  const bounds = { min: -100, max: 100, dimension: 400 };

  it('moves freely within the bounds', () => {
    expect(dragWithin({ position: 0, delta: 60, ...bounds })).toBe(60);
    expect(dragWithin({ position: 50, delta: -120, ...bounds })).toBe(-70);
  });

  it('resists past an edge, less and less', () => {
    const past = dragWithin({ position: 100, delta: 100, ...bounds });
    expect(past).toBeGreaterThan(100);
    expect(past).toBeLessThan(200);
    const further = dragWithin({ position: past, delta: 100, ...bounds });
    expect(further - past).toBeLessThan(past - 100);
  });

  it('never pulls further than the dimension past the edge', () => {
    expect(dragWithin({ position: 100, delta: 1_000_000, ...bounds })).toBeLessThan(500);
    expect(dragWithin({ position: -100, delta: -1_000_000, ...bounds })).toBeGreaterThan(-500);
  });

  it('retraces the same curve back, so a drag out and in ends where it started', () => {
    const out = dragWithin({ position: 80, delta: 150, ...bounds });
    expect(dragWithin({ position: out, delta: -150, ...bounds })).toBeCloseTo(80, 6);
  });

  it('splits one large drag the same as several small ones', () => {
    const once = dragWithin({ position: 0, delta: 300, ...bounds });
    let stepped = 0;
    for (let i = 0; i < 30; i++) stepped = dragWithin({ position: stepped, delta: 10, ...bounds });
    expect(stepped).toBeCloseTo(once, 6);
  });

  it('bands the zoom scale below 1× and above the maximum', () => {
    const pinchedIn = dragWithin({ position: 1, delta: -0.5, min: 1, max: 4, dimension: 1 });
    expect(pinchedIn).toBeGreaterThan(0.5);
    expect(pinchedIn).toBeLessThan(1);
    const pinchedOut = dragWithin({ position: 4, delta: 2, min: 1, max: 4, dimension: 1 });
    expect(pinchedOut).toBeGreaterThan(4);
    expect(pinchedOut).toBeLessThan(5);
  });
});
