import { keysInOrder } from './fractionalIndex';

/**
 * The new positions, as `{ [id]: { position } }`, that put `items` in the order given, changing as
 * few as possible (keysInOrder): only the items out of that order are written.
 */
export function positionsInOrder(
  items: { id: string; position: string | null }[],
): Record<string, { position: string }> {
  const keys = keysInOrder(items.map((item) => item.position));
  return Object.fromEntries(
    items.flatMap((item, i) => (item.position === keys[i] ? [] : [[item.id, { position: keys[i]! }]])),
  );
}
