/**
 * The pending moves the rows don't show yet. A move's write committed when `rowsWhenWritten` is set
 * (the rows at that moment); rows change only after a committed write's re-read, so the first rows
 * after it show the move, and from then on the rows alone are the truth.
 */
export default function dropLandedMoves(moves, rows) {
  return moves.filter((move) => !move.rowsWhenWritten || move.rowsWhenWritten === rows);
}
