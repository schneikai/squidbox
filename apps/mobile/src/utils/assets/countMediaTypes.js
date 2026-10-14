/** How many of `assets` are photos and how many videos, the counts getAssetCountInfo takes. */
export default function countMediaTypes(assets) {
  const counts = { photo: 0, video: 0 };
  for (const asset of assets) counts[asset.mediaType] += 1;
  return counts;
}
