import parts from './octopusParts.json';

// Where the native splash shows the octopus in a window of this size: assets/splash.png scaled to
// fit it whole (`resizeMode: 'contain'`) and centred. `width` is the size to give <Octopus>; `height` is its box's, where the octopus ends.
export function splashOctopusFrame({ width, height }: { width: number; height: number }) {
  const [imageWidth, imageHeight] = parts.image;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  return {
    left: (width - imageWidth * scale) / 2 + parts.offset[0] * scale,
    top: (height - imageHeight * scale) / 2 + parts.offset[1] * scale,
    width: parts.size[0] * scale,
    height: parts.size[1] * scale,
  };
}
