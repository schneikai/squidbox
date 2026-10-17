/**
 * The pending moves the rows don't show yet. A move's `writtenAt` is the db's committed-write count
 * that includes its write; rows read at or after that count (`readAt`, see useLiveQueryState) show
 * it, so from then on the rows alone are the truth. Rows read earlier may predate the write, even
 * when they land after it. None while reordering is off: the rows then come in an order the moves
 * weren't made on (another sort, a filter, a search).
 */
export default function dropLandedMoves(moves, readAt, reorderEnabled) {
  if (!reorderEnabled) return moves.length === 0 ? moves : [];
  return moves.filter((move) => move.writtenAt === undefined || readAt < move.writtenAt);
}
