/**
 * A drag's slot order (`order`, ids) brought up to date with the rows (`rowIds`, in their order):
 * ids no longer among them leave, except `keepId` (the lifted one), and new ones go right after the
 * row before them in `rowIds` (first if none), so a page the auto-scroll loaded lands at the end and
 * a synced new album among the others.
 */
export default function mergeRowIds(order, rowIds, keepId) {
  const live = new Set(rowIds);
  const merged = order.filter((id) => live.has(id) || id === keepId);
  const known = new Set(merged);
  rowIds.forEach((id, i) => {
    if (known.has(id)) return;
    merged.splice(i === 0 ? 0 : merged.indexOf(rowIds[i - 1]) + 1, 0, id);
    known.add(id);
  });
  return merged;
}
