import { keysInOrder } from './fractionalIndex';

/**
 * The new positions, as `{ [id]: { position } }`, that put item `id` right after item `afterId`
 * (`null`: first). `items` are in order by position, never-placed ones (`null`) first; the moved
 * item may be anywhere among them, and they need only reach from `afterId` to the first item after
 * it with another position. Only the moved item is written, between its new neighbors, unless the
 * items after the drop share the previous item's position (a tie from two devices, or both never
 * placed): those are placed after it, up to the next position. Nothing when `id` or `afterId` is gone.
 */
export function movePositions(
  items: { id: string; position: string | null }[],
  id: string,
  afterId: string | null,
): Record<string, { position: string }> {
  const moved = items.find((item) => item.id === id);
  const others = items.filter((item) => item.id !== id);
  const at = afterId === null ? 0 : others.findIndex((item) => item.id === afterId) + 1;
  if (!moved || (afterId !== null && at === 0)) return {};

  const lower = others[at - 1]?.position ?? null;
  let end = at;
  while (end < others.length && others[end]!.position === lower) end++;
  const upper = others[end]?.position ?? null;

  const placed = [moved, ...others.slice(at, end)];
  const keys = keysInOrder(
    placed.map((item) => (item === moved ? null : item.position)),
    lower,
    upper,
  );
  return Object.fromEntries(placed.map((item, i) => [item.id, { position: keys[i]! }]));
}
