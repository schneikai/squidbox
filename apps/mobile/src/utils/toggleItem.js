/** `items` with `item` taken out when it's there, else added at the end. */
export default function toggleItem(items, item) {
  return items.includes(item) ? items.filter((each) => each !== item) : [...items, item];
}
