/**
 * The pending moves the rows don't show yet. A move's `writtenAt` is the db's committed-write count
 * noted once its write resolved; rows read at or after that count (`readAt`, see useLiveQueryState)
 * show it, so from then on the rows alone are the truth. Rows read earlier may predate the write,
 * even when they land after it.
 */
export default function dropLandedMoves(moves, readAt) {
  return moves.filter((move) => move.writtenAt === undefined || readAt < move.writtenAt);
}
