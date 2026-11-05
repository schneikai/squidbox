// Whether two id lists hold the same ids in the same order.
export default function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, slot) => id === b[slot]);
}
