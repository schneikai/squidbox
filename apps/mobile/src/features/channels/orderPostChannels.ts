import orderChannelIds from './orderChannelIds';

/**
 * A post's channels in the order they show (the channel bar, the list's labels): the post's own (the
 * first of `parts`) first, then its other channels in the user's channel order (`channelOrder`, then the
 * catalog's: orderChannelIds). A part without a channel ranks after every known one.
 */
export default function orderPostChannels<T>(
  parts: T[],
  channelIdOf: (part: T) => string | null,
  channelOrder: string[],
): T[] {
  const [own, ...others] = parts;
  if (own === undefined) return [];
  return [own, ...orderChannelIds(others, (part) => channelIdOf(part) ?? '', channelOrder)];
}
