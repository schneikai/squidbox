/** An asset in words, for a list of failures: "Photo IMG_0001.jpg". */
export function describeAsset({ mediaType, filename }: { mediaType?: unknown; filename?: unknown }): string {
  return `${mediaType === 'video' ? 'Video' : 'Photo'} ${filename}`;
}
