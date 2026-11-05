/** `items` with `item` taken out when it's there, else added at the end. */
export default function toggleItem<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((each) => each !== item) : [...items, item];
}
