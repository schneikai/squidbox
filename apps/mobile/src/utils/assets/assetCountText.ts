/** "1 Asset", "4 Assets", "1,000 Assets": a number of assets, as a channel's media limit says it. */
export default function assetCountText(count: number): string {
  return count === 1 ? '1 Asset' : `${count.toLocaleString('en-US')} Assets`;
}
