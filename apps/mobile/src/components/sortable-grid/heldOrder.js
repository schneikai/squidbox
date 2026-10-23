import mergeRowIds from './mergeRowIds';

/**
 * The ids in the order the grid holds after a drop (`hold.ids`, its slots), brought up to date with
 * the rows, or `null` when the rows alone are the truth. A drop's `writtenAt` is the db's
 * committed-write count that includes its write: rows read at or after it (`readAt`, see
 * useLiveQueryState) show it, rows read earlier may predate it even when they land after it, and
 * would spring the cells back. None while reordering is off: the rows then come in an order the drop
 * wasn't made on (a filter, a search).
 */
export default function heldOrder(hold, rows, readAt, reorderEnabled) {
  if (!hold || !reorderEnabled || (hold.writtenAt !== undefined && readAt >= hold.writtenAt)) return null;
  return mergeRowIds(
    hold.ids,
    rows.map((row) => row.id),
  );
}
