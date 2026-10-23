/**
 * A grid drop on a screen with a sort: under Custom it's a plain move. Under another sort the order
 * on screen becomes the custom one, as in Reminders: the screen switches to Custom right away, before
 * the write is queued, so every read after it is in the new order (the grid holds its cells until
 * then, see heldOrder), and goes back when the write fails. `move(change, sortOrder)` writes the
 * drop under the sort it was made on and resolves to its write count. It must queue its write at once
 * (before its first await), so the read the switch starts runs after it.
 */
export default async function reorderUnderSort(change, { sortOrder, setSortOrder, move }) {
  if (sortOrder === 'custom') return move(change, sortOrder);
  setSortOrder('custom');
  try {
    return await move(change, sortOrder);
  } catch (error) {
    setSortOrder(sortOrder);
    throw error;
  }
}
