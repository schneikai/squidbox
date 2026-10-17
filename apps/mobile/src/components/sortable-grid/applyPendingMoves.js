/**
 * The rows in the order the grid shows them: each drop not yet in the rows (`moves`, oldest first)
 * puts its row (`id`) right after `afterId` (`null`: first), in turn, as the database applies them. A
 * move whose row or `afterId` isn't among the rows changes nothing.
 */
export default function applyPendingMoves(rows, moves) {
  return moves.reduce((ordered, { id, afterId }) => {
    const moved = ordered.find((row) => row.id === id);
    const rest = ordered.filter((row) => row.id !== id);
    const after = afterId === null ? -1 : rest.findIndex((row) => row.id === afterId);
    if (!moved || (afterId !== null && after === -1)) return ordered;
    return [...rest.slice(0, after + 1), moved, ...rest.slice(after + 1)];
  }, rows);
}
