/**
 * The rows in the order the grid shows them: each drop not yet in the rows (`moves`, oldest first)
 * puts its asset right after `afterId` (`null`: first), in turn, as the database applies them. A move
 * whose asset or `afterId` isn't among the rows changes nothing.
 */
export default function applyPendingMoves(rows, moves) {
  return moves.reduce((ordered, { assetId, afterId }) => {
    const moved = ordered.find((asset) => asset.id === assetId);
    const rest = ordered.filter((asset) => asset.id !== assetId);
    const after = afterId === null ? -1 : rest.findIndex((asset) => asset.id === afterId);
    if (!moved || (afterId !== null && after === -1)) return ordered;
    return [...rest.slice(0, after + 1), moved, ...rest.slice(after + 1)];
  }, rows);
}
