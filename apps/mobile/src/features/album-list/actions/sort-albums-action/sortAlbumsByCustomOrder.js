/**
 * The albums' custom order: albums never placed (new ones) first, newest first, then the placed ones
 * by their fractional-index `position`; ties go by `id`, like edges, so every sort and every device
 * agrees on one order.
 */
export default function sortAlbumsByCustomOrder(a, b) {
  if (a.position == null && b.position == null) {
    const newer = (b.createdAt ?? 0) - (a.createdAt ?? 0);
    if (newer !== 0) return newer;
  } else if (a.position == null) {
    return -1;
  } else if (b.position == null) {
    return 1;
  } else if (a.position !== b.position) {
    return a.position < b.position ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
