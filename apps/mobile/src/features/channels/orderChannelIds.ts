import { CHANNELS } from '@squidbox/shared';

/**
 * Channel ids in the order a post shows its channels: the user's channels' order (`userOrder`), then
 * the ones no longer in the user's list in the catalog's order, then ids this build doesn't know.
 * Stable, so two posts on one channel keep their order.
 */
export default function orderChannelIds<T>(items: T[], channelIdOf: (item: T) => string, userOrder: string[]): T[] {
  const rank = (id: string) => {
    const user = userOrder.indexOf(id);
    if (user >= 0) return user;
    const catalog = CHANNELS.findIndex((channel) => channel.id === id);
    return userOrder.length + (catalog >= 0 ? catalog : CHANNELS.length);
  };
  return [...items].sort((a, b) => rank(channelIdOf(a)) - rank(channelIdOf(b)));
}
