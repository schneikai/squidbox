import orderChannelIds from './orderChannelIds';

/**
 * A post's versions in the order they show (the channel bar, the list's labels): the post's own (the
 * first of `parts`) first, then its other versions by their first stored channel (`channelIdsOf(part)[0]`)
 * in the user's channel order (`channelOrder`, then the catalog's: orderChannelIds). Ticking a channel
 * appends it, so a version keeps its place. A part without a channel ranks after every known one.
 */
export default function orderPostChannels<T>(
  parts: T[],
  channelIdsOf: (part: T) => readonly string[],
  channelOrder: string[],
): T[] {
  const [own, ...others] = parts;
  if (own === undefined) return [];
  return [own, ...orderChannelIds(others, (part) => channelIdsOf(part)[0] ?? '', channelOrder)];
}
