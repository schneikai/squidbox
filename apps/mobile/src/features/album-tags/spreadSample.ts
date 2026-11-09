/**
 * `count` of `items` spread through them: the first, the last and evenly between, each once, in
 * order (an album's Tag it sample). All of them when there are no more than `count`; the first when
 * `count` is 1.
 */
export default function spreadSample<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  if (count <= 1) return items.slice(0, count);
  const indexes = new Set(Array.from({ length: count }, (_, i) => Math.round((i * (items.length - 1)) / (count - 1))));
  return [...indexes].map((index) => items[index]!);
}
