import { CHANNELS } from '@squidbox/shared';

/**
 * Channel ids (or items with one, `channelIdOf`) in the order a post shows its channels: the user's
 * channels' order (`userOrder`), then the ones no longer in the user's list in the catalog's order,
 * then ids this build doesn't know.
 * Stable, so two posts on one channel keep their order.
 */
export default function orderChannelIds(ids: readonly string[], userOrder: string[]): string[];
export default function orderChannelIds<T>(items: T[], channelIdOf: (item: T) => string, userOrder: string[]): T[];
export default function orderChannelIds<T>(
  items: readonly T[],
  channelIdOrOrder: ((item: T) => string) | string[],
  userOrderOrNone?: string[],
): T[] {
  // The ids themselves, or items with their channel id.
  const [channelIdOf, userOrder] =
    typeof channelIdOrOrder === 'function'
      ? [channelIdOrOrder, userOrderOrNone ?? []]
      : [(item: T) => item as string, channelIdOrOrder];
  const rank = (id: string) => {
    const user = userOrder.indexOf(id);
    if (user >= 0) return user;
    const catalog = CHANNELS.findIndex((channel) => channel.id === id);
    return userOrder.length + (catalog >= 0 ? catalog : CHANNELS.length);
  };
  // Each item ranked once, not on every comparison.
  return items
    .map((item) => ({ item, rank: rank(channelIdOf(item)) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}
