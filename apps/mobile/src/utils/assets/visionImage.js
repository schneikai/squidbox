// The photo the assistant looks at: a JPEG whose longer side is `longSide`, at `quality` (0 to 1).
// Models shrink larger images anyway, and price most by pixels, so a small JPEG costs less and keeps
// the request small.
const visionImage = { longSide: 512, quality: 0.8 };

export default visionImage;
