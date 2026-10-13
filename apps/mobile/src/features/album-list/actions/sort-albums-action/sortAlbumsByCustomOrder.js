/**
 * The albums' custom order: albums never placed (new ones) first, newest first, then the placed ones
 * by their fractional-index `position`.
 */
export default function sortAlbumsByCustomOrder(a, b) {
  if (a.position == null && b.position == null) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  if (a.position == null) return -1;
  if (b.position == null) return 1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}
