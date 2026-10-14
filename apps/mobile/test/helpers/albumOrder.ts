/** An album's assets in canonical edge order, from its edge rows: live edges by (position, id), one per asset. */
export function albumOrder(
  rows: { albumId: string; assetId: string; position: string; id: string; deletedAt: number | null }[],
  albumId: string,
): string[] {
  const live = rows
    .filter((edge) => edge.albumId === albumId && edge.deletedAt == null)
    .sort((a, b) => (a.position < b.position || (a.position === b.position && a.id < b.id) ? -1 : 1));
  return [...new Set(live.map((edge) => edge.assetId))];
}
