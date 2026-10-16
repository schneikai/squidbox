// A closed, smooth SVG path through a traced polygon, its points' coordinates in turn in `xy` (x0, y0,
// x1, y1, …) and which of them are corners in `sharp`: quadratic curves through the edges' midpoints
// (so it never overshoots the outline), straight through sharp corners.
export function pathOf(xy, sharp) {
  'worklet';
  const n = sharp.length;
  let d = '';
  let mid = '';
  for (let i = 0; i < n; i++) {
    const x = xy[2 * i];
    const y = xy[2 * i + 1];
    const next = (2 * i + 2) % (2 * n);
    const corner = `${x.toFixed(1)},${y.toFixed(1)}`;
    mid = `${((x + xy[next]) / 2).toFixed(1)},${((y + xy[next + 1]) / 2).toFixed(1)}`;
    d += sharp[i] ? `L${corner}L${mid}` : `Q${corner} ${mid}`;
  }
  // It starts where it ends: at the midpoint of the last edge, back to the first point.
  return `M${mid}${d}Z`;
}
